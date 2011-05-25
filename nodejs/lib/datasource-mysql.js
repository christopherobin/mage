function MySqlDatabase(state, config)
{
	this.state = state;
	this.config = config;
	this.connRW = null;
	this.connRO = null;
	this.connTransaction = null;
	this.transactionRules = null;
}

// required API:
//	setupTransaction(rules)	sets up transaction behavior rules
//	commit(cb)				commits all executed statements
//	rollback(cb)			rolls back all executed statements
//	close()					closes and cleans up any open connections


var mysql = null;

MySqlDatabase.prototype._connect = function(config)
{
	if (mysql === null) mysql = require('mysql');

	var client = new mysql.Client();
	client.user = config.user;
	client.password = config.pass;
	client.host = config.host;
	client.port = config.port;
	client.database = config.dbname;
	client.connect(function() { mithril.core.logger.info('DB: Connected to MySQL server at ' + client.host + ':' + client.port); });
	return client;
};


MySqlDatabase.prototype.autoTransaction = function(rules)
{
	// rules: { write: true, read: false }

	this.transactionRules = rules;
};


// getting a connection

MySqlDatabase.prototype.source = function(readonly)
{
	if (this.connTransaction)
	{
		return this.connTransaction;
	}

	if ((readonly && this.transactionRules.read) || (!readonly && this.transactionRules.write))
	{
		mithril.core.logger.debug('DB: Transaction start');

		this.connTransaction = this.rw();
		this.connTransaction.query('START TRANSACTION');

		return this.connTransaction;
	}

	return readonly ? this.ro() : this.rw();
};


MySqlDatabase.prototype.ro = function()
{
	if (this.connRO === null)
	{
		if ('ro' in this.config)
			this.connRO = this._connect(this.config.ro);
		else
			this.connRO = this.rw();
	}

	return this.connRO;
};


MySqlDatabase.prototype.rw = function()
{
	if (this.connRW === null)
	{
		this.connRW = this._connect(this.config.rw);
	}

	return this.connRW;
};


// closing connections

MySqlDatabase.prototype.close = function()
{
	if (this.connRO && this.connRO !== this.connRW)
	{
		mithril.core.logger.debug('DB: Closing read-only database connection.');

		this.connRO.end();
		this.connRO = null;
	}

	if (this.connRW)
	{
		mithril.core.logger.debug('DB: Closing read/write database connection.');

		this.connRW.end();
		this.connRW = null;
	}

	this.connTransaction = null;
	this.config = null;
	this.state = null;
};


// transaction finalizing

MySqlDatabase.prototype.commit = function(cb)
{
	if (this.connTransaction)
	{
		mithril.core.logger.debug('DB: Commit');

		this.connTransaction.query('COMMIT', [], function() { cb(); });
		this.connTransaction = null;
	}
	else
		cb();
};


MySqlDatabase.prototype.rollBack = function(cb)
{
	if (this.connTransaction)
	{
		mithril.core.logger.debug('DB: Rollback');

		this.connTransaction.query('ROLLBACK', [], function() { cb(); });
		this.connTransaction = null;
	}
	else
		cb();
};


// queries / statement execution

MySqlDatabase.prototype.getOne = function(sql, params, required, errorCode, cb)
{
	// TODO: make debug() allow any amount of arguments, if we don't debug, ignore them all. This way we don't have to do JSON stringify needlessly if we don't debug.

	var _this = this;
	var db = this.source(true);

	mithril.core.logger.debug('DB: getOne ' + sql + ' using', params);

	db.query(sql, params, function(error, results) {
		if (error)
		{
			_this.state.error(errorCode, { sql: sql, params: params, error: error }, cb);
			return;
		}

		if (required && results.length != 1)
		{
			_this.state.error(errorCode, { sql: sql, params: params, error: 'expected exactly 1 record, but received ' + results.length }, cb);
			return;
		}

		var result = (results.length > 0) ? results[0] : null;

		cb(null, result);
	});
};


MySqlDatabase.prototype.getMany = function(sql, params, errorCode, cb)
{
	// TODO: make debug() allow any amount of arguments, if we don't debug, ignore them all. This way we don't have to do JSON stringify needlessly if we don't debug.

	var _this = this;
	var db = this.source(true);

	mithril.core.logger.debug('DB: getMany ' + sql + ' using', params);

	db.query(sql, params, function(error, results) {
console.dir("error: " + error);
console.dir("result: " + results);
		
		
		if (error)
		{
			_this.state.error(errorCode, { sql: sql, params: params, error: error }, cb);
		}
		else
		{
			cb(null, results);
		}
	});
};


MySqlDatabase.prototype.exec = function(sql, params, errorCode, cb)
{
	// TODO: make debug() allow any amount of arguments, if we don't debug, ignore them all. This way we don't have to do JSON stringify needlessly if we don't debug.

	var _this = this;
	var db = this.source(false);

	mithril.core.logger.debug('DB: exec ' + sql + ' using', params);

	db.query(sql, params, function(error, info) {
		if (error)
		{
			_this.state.error(errorCode, { sql: sql, params: params, error: error }, cb);
		}
		else
		{
			cb(null, info);
		}
	});
};


MySqlDatabase.prototype.buildSelect = function(fields, allowedFields, table, joins)
{

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

	function addRequiredJoin(tableAlias)
	{
		if (tableAlias in requiredJoins) return;

		var rule = joins[tableAlias];

		if ('requires' in rule)
		{
			for (var i=0; i < rule.requires.length; i++)
			{
				addRequiredJoin(rule.requires[i]);
			}
		}

		requiredJoins[tableAlias] = joins[tableAlias].sql.replace(/\?/g, tableAlias);
	}

	var result = ['SELECT'];
	var resultFields = [];

	for (var i=0; i < fields.length; i++)
	{
		var fieldAlias = fields[i];
		var field = allowedFields[fieldAlias];

		if (typeof field == 'string')
		{
			if (field == fieldAlias)
				resultFields.push(field);
			else
				resultFields.push(field + ' AS ' + fieldAlias);
		}
		else
		{
			resultFields.push(field[0] + '.' + field[1] + ' AS ' + fieldAlias);
			addRequiredJoin(field[0]);
		}
	}

	result.push(resultFields.join(', '));
	result.push('FROM ' + table);

	for (var tableAlias in requiredJoins)
	{
		result.push(requiredJoins[tableAlias]);
	}

	return result.join(' ');
};


exports.MySqlDatabase = MySqlDatabase;

