var mithril     = require('../../mithril');
var async       = require('async');
var crypto      = require('crypto');
var querystring = require('querystring');

var config;


exports.onNewPlayer = null; // override to hook into the tool's "new player" feature

exports.getManageCommands = function () {
	return ['createGm', 'deleteGm', 'editGm', 'getGms', 'createNewPlayer'];
};


function createSession(state, params, cb) {
	var sql = 'SELECT actor, password FROM gm WHERE username = ?';

	state.datasources.db.getOne(sql, [params.username], false, null, function (error, gm) {
		if (error) {
			return cb(error);
		}

		if (gm && exports.checkPassword(params.password, gm.password)) {
			mithril.session.register(state, gm.actor, function (error, session) {
				if (error) {
					mithril.core.logger.error(error);
					cb(error);
				} else {
					cb(null, gm.actor, session);
				}
			});
		} else {
			state.userError('invalidLogin', cb);
		}
	});
}


exports.setup = function (state, cb) {
	config = mithril.core.config.get('tool');

	var httpServer = mithril.core.msgServer.getHttpServer();

	if (!httpServer) {
		mithril.core.logger.error(null, 'Could not add GM routes, because there is no HTTP server.');
		return cb();
	}

	httpServer.addRoute('/gmlogin', function (request, path, gParams, callback) {
		var data = '';

		request.on('data', function (chunk) {
			data += chunk;
		});

		request.on('end', function () {
			var postData = {};

			if (data) {
				postData = querystring.parse(data);
			}

			var state = new mithril.core.State();

			createSession(state, postData, function (error, actorId, session) {
				state.close();

				if (error) {
					if (error === 'invalidLogin') {
						return callback(401);
					}

					return callback(false);
				}

				var response = actorId + ':' + session.key;

				callback(200, response, { "Access-Control-Allow-Origin": '*' });
			});
		});
	});

	cb();
};


exports.checkPassword = function (pass, realPass) {
    pass = crypto.createHmac('sha1', config.hashkey).update(pass).digest('hex');
	return (pass === realPass);
};


exports.getGm = function (state, params, callback) {

};


exports.addGm = function (state, params, callback) {
	var actorId;

	async.waterfall([
		function (callback) {
			mithril.actor.addActor(state, params.username, callback);
//			mithril.game.addGamePlayer(state, params.username, params.language || 'EN', callback);		// if I need to make a gm a real player
		},
		function (data, callback) {
			actorId = data.id;
			callback();
		},
		function (callback) {
			var sql     = 'INSERT INTO gm(actor, username, password) VALUES(?, ?, ?)';
			var password = crypto.createHmac('sha1', config.hashkey).update(params.password).digest('hex');
			var gparams = [actorId, params.username, password];

			state.datasources.db.exec(sql, gparams, null, function (err) {
				if (err) {
					return callback(err);
				}
			});

			mithril.player.addPlayer(state, actorId, 0, 'EN', callback);
		},
		function (info, callback) {
			var propMap = new mithril.core.PropertyMap();

			if (params && params.rights) {
				propMap.add('rights', params.rights);
			}

			exports.setProperties(state, actorId, propMap, callback);
		}
	],
	function (error) {
		if (error) {
			return callback(error);
		}
		callback(null, actorId);
	});
};



exports.getProperties = function (state, actorId, properties, cb) {
	// If a property is defined with the language AND without a language, one will overwrite the other without any guarantee about which is returned.
	// This is by design.

	var db = state.datasources.db;

	var query = 'SELECT property, type, value FROM gm_data WHERE actor = ? AND language IN (?, ?)';
	var params = [actorId, state.language(), ''];

	if (properties && properties.length > 0) {
		query += ' AND property IN (' + db.getPlaceHolders(properties.length) + ')';
		params = params.concat(properties);
	}

	db.getMapped(query, params, { key: 'property', type: 'type', value: 'value' }, null, function (error, data) {
		if (error) {
			return cb(error);
		}

		cb(null, data);
	});
};


exports.setProperties = function (state, actorId, propertyMap, cb) {
	// TODO: known issue, we use actorId to store the data and emit the event, yet we use state.language() to pick event language output.
	// This may not correspond with actorId, so we should probably drop the entire actorId argument from this function and stick to state.actorId.

	var properties = propertyMap.getAllFlat(true, true);

	var len = properties.length;

	if (len === 0) {
		return cb();
	}

	var sql = 'INSERT INTO gm_data VALUES';

	var values = [];
	var params = [];

	for (var i = 0; i < len; i++) {
		var prop = properties[i];

		values.push('(?, ?, ?, ?, ?)');
		params.push(actorId, prop.property, prop.language || '', prop.type, prop.value);
	}

	sql += values.join(', ') + ' ON DUPLICATE KEY UPDATE value = VALUES(value)';

	state.datasources.db.exec(sql, params, null, function (error) {
		if (error) {
			return cb(error);
		}

		state.emit(actorId, 'actor.data.edit', { properties: propertyMap.getAll(state.language()) });

		cb();
	});
};


exports.replaceProperties = function (state, actorId, properties, fnReplace, cb) {
	exports.getProperties(state, actorId, properties, function (error, data) {
		if (error) {
			return cb(error);
		}

		var propertyMap = new mithril.core.PropertyMap();

		for (var i = 0, len = properties.length; i < len; i++) {
			var property = properties[i];

			var value = (property in data) ? data[property] : null;

			propertyMap.add(property, fnReplace(property, value));
		}

		exports.setProperties(state, actorId, propertyMap, cb);
	});
};


exports.delProperties = function (state, actorId, properties, cb) {
	var db = state.datasources.db;

	var sql = 'DELETE FROM gm_data WHERE actor = ? AND property IN (' + db.getPlaceHolders(properties.length) + ')';
	var params = [actorId].concat(properties);

	db.exec(sql, params, null, function (error) {
		if (error) {
			return cb(error);
		}

		state.emit(actorId, 'actor.data.del', { properties: properties });

		cb();
	});
};

exports.delGm = function (state, id, cb) {
	// TODO: removing an actor involves more than just this record. Eg: objects would remain intact.

	var sql = 'DELETE FROM actor WHERE id = ?';
	var params = [id];

	state.datasources.db.exec(sql, params, null, cb);
};

exports.getGms = function (state, cb) {
	var sql = 'SELECT actor, username FROM gm';
	state.datasources.db.getMany(sql, [], null, function (error, gms) {
		if (error) {
			mithril.core.logger.error(error);
			return cb(error);
		}

		async.forEachSeries(gms, function (gm, callback) {
			exports.getProperties(state, gm.actor, [], function (errors, data) {
				if (errors) {
					return callback(errors);
				}

				if (data) {
					gm.data = data;
					callback(null, gm);
				}
			});
		}, function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, gms);
		});
	});
};

