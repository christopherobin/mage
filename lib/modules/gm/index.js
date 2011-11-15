var mithril = require('../../mithril');
var async   = require('async');
var crypto  = require('crypto');
var config;

exports.getManageCommands = function () {
	return ['createGm', 'deleteGm', 'editGm', 'getGms'];
};


function createSession(state, params, cb) {
	var sql = 'SELECT actor, password FROM gm WHERE username = ?';

	state.datasources.db.getOne(sql, [params.username], false, null, function (error, gm) {
		if (error) {
			return cb(error);
		}

		if (gm && exports.checkPassword(params.password, gm.password)) {
			mithril.player.sessions.register(state, gm.actor, function (error, session) {
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
	var languages = ['EN'];
	config = mithril.getConfig('tool');

	var pathTool = mithril.getConfig('module.mithrilui.tool');
	var pathGame = mithril.getConfig('module.mithrilui.game');

	if (!pathTool.paths) {
		// TODO: Must remove dependencies on libsystem  i.e. viewport system
		pathTool.paths = {
			"pages": "node_modules/mithril/tools/pages",
			"views": "node_modules/mithril/tools/views",
			"custom": {
				"libsystem": pathGame.paths.custom.libsystem,
				"libtool":  "node_modules/mithril/tools/libtool"
			}
		};
	}

	var toolPackage = mithril.mithrilui.addPackage('tool');

	var loader = new mithril.mithrilui.MuiPage('loader', languages);
	toolPackage.addPage(loader);

	var main = new mithril.mithrilui.MuiPage('main', languages);

	main.addView('ToolDashboard',     'tool_dashboard',      null,   { });
	main.addView('ToolSession',       'tool_session',        null,   { });
	main.addView('ToolGacha',         'tool_gacha',          null,   { });
	main.addView('ToolCreator',       'tool_creator',        null,   { });

	toolPackage.addPage(main);

	var assets = mithril.assets;

	// Registering images for jquery ui
	assets.regImg('tool/ui-bg_diagonals-thick_8_333333_40x40', '/$0.png');
	assets.regImg('tool/ui-bg_flat_65_ffffff_40x100', '/$0.png');
	assets.regImg('tool/ui-bg_glass_40_111111_1x400', '/$0.png');
	assets.regImg('tool/ui-bg_glass_55_1c1c1c_1x400', '/$0.png');
	assets.regImg('tool/ui-bg_highlight-hard_40_aaaaaa_1x100', '/$0.png');
	assets.regImg('tool/ui-bg_highlight-hard_100_f9f9f9_1x100', '/$0.png');
	assets.regImg('tool/ui-bg_highlight-soft_50_aaaaaa_1x100', '/$0.png');
	assets.regImg('tool/ui-bg_inset-hard_45_cd0a0a_1x100', '/$0.png');
	assets.regImg('tool/ui-bg_inset-hard_55_ffeb80_1x100', '/$0.png');
	assets.regImg('tool/ui-icons_4ca300_256x240', '/$0.png');
	assets.regImg('tool/ui-icons_222222_256x240', '/$0.png');
	assets.regImg('tool/ui-icons_bbbbbb_256x240', '/$0.png');
	assets.regImg('tool/ui-icons_ededed_256x240', '/$0.png');
	assets.regImg('tool/ui-icons_ffcf29_256x240', '/$0.png');
	assets.regImg('tool/ui-icons_ffffff_256x240', '/$0.png');


	mithril.core.userCommandCenter.expose({		
		hooks: ['mithril.session']
	}, {
		actor: mithril.actor.getManageCommands(),
		manage: mithril.manage.getManageCommands,
		shop: mithril.shop.getManageCommands(),
		gm: mithril.gm.getManageCommands(),
		gc: mithril.gc.getManageCommands(),
		player: mithril.player.getManageCommands()
	});


	mithril.addRoute('/gmlogin', function (request, path, gParams, callback) {
		var postData = {};

		request.setEncoding('utf8');
		request.on('data', function (data) {
			data = data.split('&');
			for (var i = 0, len = data.length; i < len; i++) {
				var pair = data[i].split('=');
				postData[pair[0]] = pair[1];
			}
		});

		request.on('end', function () {
			var state = new mithril.core.State();

			createSession(state, postData, function (error, actorId, session) {
				state.close();

				if (error) {
					if (error === 'invalidLogin') {
						return callback(401);
					}

					return callback(false);
				}

				var response = {
					session: session.key,
					id: actorId
				};

				callback(200, JSON.stringify(response), { "Access-Control-Allow-Origin": '*' });
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

