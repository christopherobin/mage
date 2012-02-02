var mithril     = require('../../mithril');
var async       = require('async');
var crypto      = require('crypto');
var querystring = require('querystring');

var config;


exports.onNewPlayer = null; // override to hook into the tool's "new player" feature
exports.onLogin     = null; // game overrides this
exports.toolsDir = __dirname + '/../../../tools';

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


exports.exposeTool = function (cb) {
	config = mithril.core.config.get('module.gm');

	var commands = {};

	for (var modName in mithril.core.modules) {
		var mod = mithril.core.modules[modName];

		if (mod.getManageCommands) {
			commands[modName] = mod.getManageCommands();
		}
	}

	var commandCenter = mithril.addCommandCenter(
		'tool',
		{ hooks: ['mithril.session'] },
		commands
	);

	commandCenter.expose({}, { gm: ['login'] });

	function Viewport() {
		this.views = [];
	}

	var WebApp = mithril.core.app.web.WebApp;
	var toolApp = new WebApp('tool', { languages: ['EN'] });

	toolApp.setIndexPage(exports.toolsDir + '/pages/loader');

	var toolPage = new Viewport();

	Viewport.prototype.addView = function (className, name, cssClassNames, dataParams) {
		this.views.push({ name: name, className: className, cssClassNames: cssClassNames || [], dataParams: dataParams });
	};


	Viewport.prototype.build = function (buildTarget, language, contextName, key, cb) {
		var viewportData = '';

		async.forEachSeries(
			this.views,
			function (view, callback) {
				var path = exports.toolsDir + '/views/' + view.className;

				var subTarget = new mithril.core.app.BuildTarget(buildTarget.app, 'dir', path, buildTarget.context);

				subTarget.build(language, function (error, data) {
					if (error) {
						return cb(error);
					}

					switch (contextName) {
					case 'html':

						// wrap the data in a div
						var cssClasses = view.cssClassNames.slice();
						cssClasses.unshift('view' + view.className);
						view.dataParams.name = view.name;
						cssClasses.unshift('view');

						var pre = '<div class="' + cssClasses.join(' ') + '"';

						for (var key in view.dataParams) {
							pre += ' data-' + key + '="' + view.dataParams[key] + '"';
						}

						pre += '>\n';

						var post = '\n</div>\n';

						data = pre + data + post;

						break;
					}

					viewportData += data + '\n';

					callback();
				});
			},
			function (error) {
				if (error) {
					return cb(error);
				}

				cb(null, viewportData);
			}
		);
	};

	mithril.core.app.builders.add('toolviewport', toolPage.build.bind(toolPage));

	toolPage.addView('ToolDashboard',  'tool_dashboard',      null, {});
	toolPage.addView('ToolSession',    'tool_session',        null, {});
	toolPage.addView('ToolGacha',      'tool_gacha',          null, {});
	toolPage.addView('ToolCreator',    'tool_creator',        null, {});


	var toolAssets = mithril.assets.createAssetMap({ name: 'toolAssets' });

	// Registering images for jquery ui

	toolAssets.regImg   = toolAssets.regFile.bind(toolAssets, 'img');

	toolAssets.regImg('ui-bg_diagonals-thick_8_333333_40x40', '/$0.png');
	toolAssets.regImg('ui-bg_flat_65_ffffff_40x100', '/$0.png');
	toolAssets.regImg('ui-bg_glass_40_111111_1x400', '/$0.png');
	toolAssets.regImg('ui-bg_glass_55_1c1c1c_1x400', '/$0.png');
	toolAssets.regImg('ui-bg_highlight-hard_40_aaaaaa_1x100', '/$0.png');
	toolAssets.regImg('ui-bg_highlight-hard_100_f9f9f9_1x100', '/$0.png');
	toolAssets.regImg('ui-bg_highlight-soft_50_aaaaaa_1x100', '/$0.png');
	toolAssets.regImg('ui-bg_inset-hard_45_cd0a0a_1x100', '/$0.png');
	toolAssets.regImg('ui-bg_inset-hard_55_ffeb80_1x100', '/$0.png');
	toolAssets.regImg('ui-icons_4ca300_256x240', '/$0.png');
	toolAssets.regImg('ui-icons_222222_256x240', '/$0.png');
	toolAssets.regImg('ui-icons_bbbbbb_256x240', '/$0.png');
	toolAssets.regImg('ui-icons_ededed_256x240', '/$0.png');
	toolAssets.regImg('ui-icons_ffcf29_256x240', '/$0.png');
	toolAssets.regImg('ui-icons_ffffff_256x240', '/$0.png');


	toolApp.addPage('main', exports.toolsDir + '/pages/main', { assetMap: toolAssets });

	toolApp.expose(cb);
};


exports.checkPassword = function (pass, realPass) {
    pass = crypto.createHmac('sha1', config.hashkey).update(pass).digest('hex');
	return (pass === realPass);
};


exports.getGm = function (state, params, callback) {

};


exports.addGm = function (state, username, password, rights, callback) {
	var actorId;
	var newPassword = password;

	async.waterfall([
		function (callback) {
			mithril.actor.addActor(state, username, callback);
		},
		function (data, callback) {
			actorId = data.id;
			callback();
		},
		function (callback) {
			var sql     = 'INSERT INTO gm (actor, username, password) VALUES(?, ?, ?)';
			var password = crypto.createHmac('sha1', config.hashkey).update(newPassword).digest('hex');
			var gparams = [actorId, username, password];

			state.datasources.db.exec(sql, gparams, null, function (err) {
				if (err) {
					return callback(err);
				}
			});

			mithril.player.addPlayer(state, actorId, 0, 'EN', callback);
		},
		function (info, callback) {
			var propMap = new mithril.core.PropertyMap();

			if (rights) {
				propMap.add('rights', rights);
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

