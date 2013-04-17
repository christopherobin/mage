var mage = require('../../mage');
var async = require('async');
var crypto = require('crypto');


var registeredToolPages = [];
var config;


exports.onNewPlayer = null; // override to hook into the tool's "new player" feature
exports.onLogin     = null; // game overrides this


exports.createTools = function (cb) {
	config = mage.core.config.get('module.gm');

	var toolApp = mage.core.app.get('tool');

	toolApp.setIndexPage(__dirname + '/toolpages/loader');

	var toolAssets = new mage.assets.AssetMap({ name: 'toolAssets' });

	var modules = mage.listModules();

	async.forEachSeries(
		modules,
		function (modName, callback) {
			var mod = mage.core.modules[modName];

			if (!mod) {
				var error = new Error('Module "' + modName + '" not found while trying to create a tool for it.');

				return callback(error);
			}

			var toolPath = mage.getModulePath(modName) + '/tool';

			try {
				var tool = require(toolPath);

				if (tool.setup) {
					//TODO: when multiple assetmaps are handled, figure out some way to handle them
					var options = {
						assets: toolAssets
					};

					// setup function for each module. Allows a module to register multiple pages (ie, game can register a bunch of tool pages)
					tool.setup(toolApp, options, callback);
				} else {
					callback();
				}
			} catch (err) {
				// the tool is optional, so this exception is not fatal or can even be considered an error
				callback();
			}
		},
		function (error) {
			if (error) {
				return cb(error);
			}

			registeredToolPages = Object.keys(toolApp.pages);

			// Adding page main last so that it will not be available as a gm right
			toolApp.addPage('main', __dirname + '/toolpages/main', { assetMap: toolAssets });

			cb(null, toolApp);
		}
	);
};


exports.getRegisteredTools = function () {
	return registeredToolPages;
};


exports.checkPassword = function (pass, realPass) {
    pass = crypto.createHmac('sha1', config.hashkey).update(pass).digest('hex');
	return (pass === realPass);
};


exports.login = function (state, username, password, cb) {
	var sql = 'SELECT actor, password FROM gm WHERE username = ?';
	state.datasources.db.getOne(sql, [username], false, null, function (error, gm) {
		if (error) {
			return cb(error);
		}

		if (!gm) {
			return state.error('invalidLogin', null, cb);
		}

		if (!exports.checkPassword(password, gm.password)) {
			return state.error('invalidLogin', null, cb);
		}

		var rightsSql = 'SELECT value FROM gm_data WHERE actor = ? AND property = "rights"';

		state.datasources.db.getOne(rightsSql, [gm.actor], false, null, function (error, result) {
			if (error) {
				return cb(error);
			}

			var rights;

			if (result && result.value) {
				try {
					rights = JSON.parse(result.value);
				} catch (e) {
					return state.error(null, 'Rights JSON not parseable', cb);
				}
			}

			mage.session.register(state, gm.actor, null, { access: 'admin' }, function (error, session) {
				if (error) {
					return cb(error);
				}

				var response = {
					sessionKey: session.getFullKey(),
					rights: rights
				};

				state.respond(response);

				return cb();
			});
		});
	});
};


exports.addGm = function (state, username, newPassword, rights, cb) {
	var actorId;

	// Some error checking, already checked on clientside, but can never be too sure.
	if (!username) {
		return state.userError('missingUserName', cb);
	}

	if (!newPassword) {
		return state.userError('missingPassword', cb);
	}

	if (newPassword.length < 6) {
		return state.userError('passwordTooShort', cb);
	}


	var password = crypto.createHmac('sha1', config.hashkey).update(newPassword).digest('hex');

	async.waterfall([
		function (callback) {
			mage.actor.addActor(state, username, callback);
		},
		function (data, callback) {
			actorId = data.id;

			var sql     = 'INSERT INTO gm (actor, username, password) VALUES(?, ?, ?)';
			var gparams = [actorId, username, password];

			state.datasources.db.exec(sql, gparams, null, callback);
		},
		function (info, callback) {
			var propMap = new mage.core.PropertyMap();

			if (rights) {
				propMap.add('rights', rights);
			}

			exports.setProperties(state, actorId, propMap, callback);
		}
	],
	function (error) {
		if (error) {
			return cb(error);
		}

		cb(null, actorId);
	});
};


exports.editGm = function (state, actor, password, rights, cb) {
	if (password && password.length < 6) {
		return state.userError('passwordTooShort', cb);
	}


	var propMap = new mage.core.PropertyMap();

	if (rights) {
		propMap.add('rights', rights);
	}


	mage.gm.setProperties(state, actor, propMap, function (error) {
		if (error) {
			return cb(error);
		}


		if (password) {
			var sql = 'UPDATE gm SET password = ? WHERE actor = ?';
			var pass = crypto.createHmac('sha1', config.hashkey).update(password).digest('hex');
			var args = [pass, actor];

			return state.datasources.db.exec(sql, args, null, cb);
		}

		cb();
	});
};


exports.delGm = function (state, actorId, cb) {
	// TODO: removing an actor involves more than just this record. Eg: objects would remain intact.

	var sql = 'DELETE FROM gm WHERE actor = ?';
	var params = [actorId];

	state.datasources.db.exec(sql, params, null, function (error) {
		if (error) {
			return cb(error);
		}

		cb();
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

		cb();
	});
};


exports.replaceProperties = function (state, actorId, properties, fnReplace, cb) {
	exports.getProperties(state, actorId, properties, function (error, data) {
		if (error) {
			return cb(error);
		}

		var propertyMap = new mage.core.PropertyMap();

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
	var sql = 'DELETE FROM actor WHERE id = ?';
	var params = [id];

	state.datasources.db.exec(sql, params, null, cb);
};

exports.getGms = function (state, cb) {
	var sql = 'SELECT actor, username FROM gm';
	state.datasources.db.getMany(sql, [], null, function (error, gms) {
		if (error) {
			mage.core.logger.error(error);
			return cb(error);
		}

		async.forEachSeries(gms, function (gm, callback) {
			exports.getProperties(state, gm.actor, [], function (errors, data) {
				if (errors) {
					return callback(errors);
				}

				if (data) {
					gm.data = data;
				}

				callback(null, gm);
			});
		}, function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, gms);
		});
	});
};

