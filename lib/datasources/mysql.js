var mithril = require('../mithril'),
    mysql = require('mysql');

var EventEmitter = require('events').EventEmitter;

exports = module.exports = new EventEmitter();


// TODO: remove source(), autoTransaction(), connTransaction and transactionRules
// we probably just want to hardwire the transaction logic into the module.
// the functions that need a connection can then just call rw() and ro(), instead of source(bool, ..)
// this would really simplify the logic and therefore improve performance.


function MySqlDatabase(state, config) {
	this.state = state;
	this.config = config;
	this.connRW = null;
	this.connRO = null;
	this.connTransaction = null;
	this.transactionRules = null;
}


MySqlDatabase.prototype._connect = function (config, cb) {
	var client = new mysql.Client();
	client.user = config.user;
	client.password = config.pass;
	client.host = config.host;
	client.port = config.port;
	client.database = config.dbname;

	client.connect(function (error) {
		if (error) {
			mithril.core.logger.error('DB: Failed to connect to MySQL server at ' + client.host + ':' + client.port);
			return cb(error);
		}

		mithril.core.logger.debug('DB: Connected to MySQL server at ' + client.host + ':' + client.port);
		cb(null, client);
	});
};


MySqlDatabase.prototype.autoTransaction = function (rules) {
	// rules: { write: true, read: false }

	this.transactionRules = rules;
};


// getting a connection

MySqlDatabase.prototype.source = function (readonly, cb) {
	if (this.connTransaction) {
		return cb(null, this.connTransaction);
	}

	if ((readonly && this.transactionRules.read) || (!readonly && this.transactionRules.write)) {
		var _this = this;

		this.rw(function (error, conn) {
			if (error) {
				return cb(error);
			}

			//conn.oldQuery = conn.query;
			//conn.query = function (sql, params, callback) {
			//	exports.emit('mysqlQuery');
			//	conn.oldQuery(sql, params, callback);
			//};

			mithril.core.logger.debug('DB: Transaction start');

			conn.query('START TRANSACTION', [], function (error) {
				if (error) {
					return cb(error);
				}

				_this.connTransaction = conn;

				cb(null, conn);
			});
		});
	} else {
		if (readonly) {
			this.ro(cb);
		} else {
			this.rw(cb);
		}
	}
};


MySqlDatabase.prototype.ro = function (cb) {
	if (this.connRO) {
		return cb(null, this.connRO);
	}

	var _this = this;

	var callback = function (error, conn) {
		if (error) {
			return cb(error);
		}

		_this.connRO = conn;

		cb(null, conn);
	};

	if ('ro' in this.config) {
		this._connect(this.config.ro, callback);
	} else {
		this.rw(callback);
	}
};


MySqlDatabase.prototype.rw = function (cb) {
	if (this.connRW) {
		return cb(null, this.connRW);
	}

	var _this = this;

	this._connect(this.config.rw, function (error, conn) {
		if (error) {
			return cb(error);
		}

		_this.connRW = conn;

		cb(null, conn);
	});
};


// closing connections

MySqlDatabase.prototype.close = function () {
	if (this.connRO && this.connRO !== this.connRW) {
		mithril.core.logger.debug('DB: Closing read-only database connection.');

		this.connRO.end();
		this.connRO = null;
	}

	if (this.connRW) {
		mithril.core.logger.debug('DB: Closing read/write database connection.');

		this.connRW.end();
		this.connRW = null;
	}

	this.connTransaction = null;
	this.config = null;
	this.state = null;
};


// transaction finalizing

MySqlDatabase.prototype.commit = function (cb) {
	if (!this.connTransaction) {
		return cb();
	}

	this.connTransaction.query('COMMIT', [], function () {
		mithril.core.logger.debug('DB: Commit');
		cb();
	});

	this.connTransaction = null;
};


MySqlDatabase.prototype.rollBack = function (cb) {
	if (!this.connTransaction) {
		return cb();
	}

	this.connTransaction.query('ROLLBACK', [], function () {
		mithril.core.logger.debug('DB: Rollback');
		cb();
	});

	this.connTransaction = null;
};


// queries / statement execution

MySqlDatabase.prototype.getOne = function (sql, params, required, errorCode, cb) {
	var _this = this;

	this.source(true, function (error, db) {
		if (error) {
			return cb(error);
		}

		var p = params.concat();

		db.query(sql, p, function (error, results) {
			mithril.core.logger.debug('DB: getOne ' + sql + ' using', params);

			if (error) {
				_this.state.error(errorCode, { sql: sql, params: params, error: error }, cb);
				return;
			}

			var len = results.length;

			if (required && len !== 1) {
				_this.state.error(errorCode, { sql: sql, params: params, error: 'expected exactly 1 record, but received ' + len }, cb);
				return;
			}

			var result = (len > 0) ? results[0] : null;

			cb(null, result);
		});
	});
};


MySqlDatabase.prototype.getMany = function (sql, params, errorCode, cb) {
	var _this = this;

	this.source(true, function (error, db) {
		if (error) {
			return cb(error);
		}

		var p = params.concat();

		db.query(sql, p, function (error, results) {
			mithril.core.logger.debug('DB: getMany ' + sql + ' using', params);

			if (error) {
				_this.state.error(errorCode, { sql: sql, params: params, error: error }, cb);
			} else {
				cb(null, results);
			}
		});
	});
};


MySqlDatabase.prototype.getMapped = function (sql, params, map, errorCode, cb) {
	var _this = this;

	this.source(true, function (error, db) {
		if (error) {
			return cb(error);
		}

		var p = params.concat();

		db.query(sql, p, function (error, results) {
			mithril.core.logger.debug('DB: getMapped ' + sql + ' using', params);

			if (error) {
				_this.state.error(errorCode, { sql: sql, params: params, error: error }, cb);
				return;
			}

			var out = {};

			for (var i = 0, len = results.length; i < len; i++) {
				var row = results[i];

				if (map.value) {
					if (map.type) {
						out[row[map.key]] = mithril.core.PropertyMap.unserialize(row[map.type], row[map.value]);
					} else {
						out[row[map.key]] = row[map.value];
					}
				} else {
					out[row[map.key]] = row;

					if (!map.keepKey) {
						delete row[map.key];
					}
				}
			}

			cb(null, out);
		});
	});
};


MySqlDatabase.prototype.exec = function (sql, params, errorCode, cb) {
	var _this = this;

	this.source(false, function (error, db) {
		if (error) {
			return cb(error);
		}

		var p = params.concat();

		db.query(sql, p, function (error, info) {
			mithril.core.logger.debug('DB: exec ' + sql + ' using', params);

			if (error) {
				_this.state.error(errorCode, { sql: sql, params: params, error: error }, cb);
			} else {
				cb(null, info);
			}
		});
	});
};


MySqlDatabase.prototype.getPlaceHolders = function (n) {
	var str = '';

	for (var i = 0; i < n; i++) {
		str += '?, ';
	}

	return str.substring(0, str.length - 2);
};


MySqlDatabase.prototype.buildSelect = function (fields, allowedFields, table, joins) {

/* example:

var fields = ['actorName'];

var joins = {
                actorActor:  { sql: 'JOIN actor AS ? ON sns_friend.actor = ?.id' },
                friendActor: { sql: 'LEFT JOIN actor AS ? ON sns_friend.friend = ?.id', requires: ['actorActor'] }
}

var allowedFields = {
                actorId:            'actorId'
                actorName:          ['actorActor', 'name'],
                actorCreationTime:  ['actorActor', 'creationTime'],
                friendName:         ['friendActor', 'name'],
                friendCreationTime: ['friendActor', 'creationTime']
}
*/
	var requiredJoins = {};

	function addRequiredJoin(tableAlias) {
		if (tableAlias in requiredJoins) {
			return;
		}

		var rule = joins[tableAlias];

		if ('requires' in rule) {
			for (var i = 0, len = rule.requires.length; i < len; i++) {
				addRequiredJoin(rule.requires[i]);
			}
		}

		requiredJoins[tableAlias] = joins[tableAlias].sql.replace(/\?/g, tableAlias);
	}

	var result = ['SELECT'];
	var resultFields = [];

	for (var i = 0, len = fields.length; i < len; i++) {
		var fieldAlias = fields[i];
		var field = allowedFields[fieldAlias];

		if (typeof field === 'string') {
			if (field === fieldAlias) {
				resultFields.push(field);
			} else {
				resultFields.push(field + ' AS ' + fieldAlias);
			}
		} else {
			resultFields.push(field[0] + '.' + field[1] + ' AS ' + fieldAlias);
			addRequiredJoin(field[0]);
		}
	}

	result.push(resultFields.join(', '));
	result.push('FROM ' + table);

	for (var tableAlias in requiredJoins) {
		result.push(requiredJoins[tableAlias]);
	}

	return result.join(' ');
};


exports.MySqlDatabase = MySqlDatabase;

