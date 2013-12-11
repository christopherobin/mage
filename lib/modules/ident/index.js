var mage   = require('../../mage');
var async  = require('async');
var logger = mage.core.logger.context('ident');

// list the apps with their individual auth engine instances
var auth = {};

/**
 * Setup an engine based on it's config and return an instance in the callback
 *
 * @param {string}   appName    The app name
 * @param {string}   engineName The name for the engine
 * @param {Object}   cfg        The config, must contain the engine type and the engine config
 * @param {Function} cb         A callback that take an error and an engine instance
 */
function setupEngine(appName, engineName, cfg, cb) {
	var engine = require('./engines/' + cfg.type);

	var engineCfg = cfg.config || {};

	// if no access level has been configured, get it from the app config or default to the lowest
	// level possible (anonymous)

	var access = cfg.access || engineCfg.access; // engineCfg.access has been deprecated in favor of cfg.access

	if (!access) {
		var appAccess = mage.core.config.get(['apps', appName, 'access']);

		access = appAccess || mage.core.access.getLowestLevel();
	}

	engine.setup(engineCfg, logger.context(engineName, cfg.type), function (error, instance) {
		if (error) {
			return cb(error);
		}

		if (!auth[appName]) {
			auth[appName] = {};
		}

		auth[appName][engineName] = {
			name: engineName,
			type: cfg.type,
			access: cfg.access || engineCfg.access,
			appName: appName,
			instance: instance,
			post: []
		};

		cb();
	});
}

/**
 * Setup the ident system, it will check every modules configured and pre-instanciate every engines
 *
 * @param {State}    state
 * @param {Function} cb
 */
exports.setup = function (state, cb) {
	// the config contains every app and their individual auth config
	var cfg = mage.core.config.get(['module', 'ident', 'apps']) || {};

	var appNames = Object.keys(cfg);

	async.eachSeries(appNames, function (appName, cb) {
		var engineNames = Object.keys(cfg[appName]);

		async.eachSeries(engineNames, function (engineName, cb) {
			try {
				setupEngine(appName, engineName, cfg[appName][engineName], cb);
			} catch (error) {
				cb(error);
			}
		}, cb);
	}, function (err) {
		// we need to do that manually as mage doesn't do it
		if (err) {
			state.error('ident', err, cb);
		}

		cb();
	});
};

/**
 * Get an engine instance
 *
 * @param {State}         state      The current state
 * @param {Object|string} engineDesc Either an engine name (will search on current app) or an object
 *                                   in the form { appName: "app", name: "engine name" }
 * @throws Error if the engine is not found or the app is invalid
 * @returns {Object} The authentication engine
 */

exports.getEngine = function (state, engineDesc) {
	if (typeof engineDesc === 'string') {
		engineDesc = {
			name: engineDesc,
			appName: state.appName
		};
	}

	// if the user is not admin, do not allow overriding the current app
	if (engineDesc.appName !== state.appName && !state.canAccess('admin')) {
		throw new Error('User ' + state.actorId + ' tried to access an engine on app "'
			+ engineDesc.appName + '" from app "' + state.appName + '" but does not have admin rights.');
	}

	if (!engineDesc.appName) {
		throw new Error('No app name provided');
	}

	if (!auth[engineDesc.appName]) {
		throw new Error('App ' + engineDesc.appName + ' has no auth configuration');
	}

	if (!auth[engineDesc.appName][engineDesc.name]) {
		throw new Error('Engine ' + engineDesc.name + ' is not configured for app ' + engineDesc.appName);
	}

	return auth[engineDesc.appName][engineDesc.name];
};

/**
 * Gives the list of engines for the current state
 *
 * @param {string}   appName The appName whose config we want to get
 * @param {Function} cb      A user command callback
 * @returns {*}
 */
exports.getEngines = function (appName, cb) {
	var engines = auth[appName];

	if (!engines) {
		return cb(null, {});
	}

	var engineNames = Object.keys(engines);
	var result = {};

	for (var i = 0; i < engineNames.length; i++) {
		var engineName = engineNames[i];

		// add engine name with type
		result[engineName] = engines[engineName].type;
	}

	cb(null, result);
};

/**
 *
 * @param {State}         state        The current state
 * @param {Object|string} engineName   The engine we want to query, if your session has admin rights, you can use { name: engineName, appName: appName }
 * @param {Object}        credentials  Parameters to give to the engine
 * @param {Object}        control      Parameters to control behavior of the auth process
 * @param {Function}      cb           A callback that take an error
 * @returns {*}
 */
exports.check = function (state, engineName, credentials, control, cb) {
	var engine;

	try {
		engine = exports.getEngine(state, engineName);
	} catch (err) {
		return state.error('ident', err, cb);
	}

	// custom access levels and user ID switching are allowed in development mode

	var access = engine.access;
	var asUserId;

	if (mage.isDevelopmentMode()) {
		control = control || {};

		access = control.access || 'admin';
		asUserId = control.userId;
	}

	// authenticate on the engine

	engine.instance.auth(state, credentials || {}, function (error, userId, userInfo) {
		if (error) {
			return cb(error);
		}

		// register a session and store the user information in its meta data

		var meta = {
			access: access,
			user: userInfo
		};

		mage.session.register(state, asUserId || userId, null, meta, function (error, session) {
			if (error) {
				return cb(error);
			}

			// run post login hooks

			async.eachSeries(
				engine.post,
				function (hook, callback) {
					hook(state, engine.appName, engine.name, callback);
				},
				function (error) {
					if (error) {
						return state.error('ident', error, cb);
					}

					cb(null, session);
				}
			);
		});
	});
};

/**
 * Send a command to an engine
 *
 * @param {State}         state   A valid state object
 * @param {Object|string} engine  The engine you want to target, see the "check" method above
 * @param {string}        command A command to run against that engine
 * @param {Object}        params  Parameters to provide to that command
 * @param {Function}      cb      A callback that take an error and the result from that command
 * @returns {*}
 */
exports.sendCommand = function (state, engine, command, params, cb) {
	var authEngine;

	try {
		authEngine = exports.getEngine(state, engine);
	} catch (err) {
		return state.error('ident', err, cb);
	}

	authEngine.instance.run(state, command, params || {}, function (err, data) {
		if (err) {
			return state.error('ident', err, cb);
		}

		state.respond(data);

		cb();
	});
};


/**
 * Runs fn for each occurency of engineName (or all engines) in the config for appName (or all apps)
 *
 * @param {string|null} appName
 * @param {string|null} engineName
 * @param {Function}    fn
 */

function forEachEngine(appName, engineName, fn) {
	// if no appName was given, apply this function to all apps

	if (!appName) {
		return Object.keys(auth).forEach(function (appName) {
			forEachEngine(appName, engineName, fn);
		});
	}

	// extract engine config for this app

	var engines = auth[appName];

	if (!engines) {
		throw new Error('App "' + appName + '" has no auth configuration');
	}

	// if no engineName was given, apply this function to all engines

	if (!engineName) {
		return Object.keys(engines).forEach(function (engineName) {
			forEachEngine(appName, engineName, fn);
		});
	}

	var engine = engines[engineName];

	if (!engine) {
		throw new Error('Engine "' + engineName + '" is not configured for app "' + appName + '"');
	}

	fn(engine);
}


/**
 * Register a post-login hook for a given appName and engineName, the hook function is called only
 * on successful login and is provided with the state, appName, engineName and a callback function.
 * If the hook wants to prevent login, it just needs to provide an error to the callback. If no
 * app name is provided, the hook will be added on all apps. If no engine name is provided the hook
 * will be added on every engine for that app.
 *
 * If more than one post-login hook is registered, they are run in the order they were registered
 * and the first hook that fails will prevent the other hooks from being run.
 *
 * For example one may want to add a banned status to the user, that can be done by checking in
 * archivist if the session's actorId is banned, and returning an error if it is the case.
 *
 * @param {string|null}   appName    The appName to target (pass null to target all apps)
 * @param {string|null}   engineName The engine to target (pass null to target all engines)
 * @param {Function}      hook       The hook function
 * @throws Error                     If the appName or engineName doesn't exist
 */
exports.registerPostLoginHook = function (appName, engineName, hook) {
	// deal with optionality of appName and engineName

	if (typeof appName === 'function') {
		hook = appName;
		appName = null;
	}

	if (typeof engineName === 'function') {
		hook = engineName;
		engineName = null;
	}

	if (typeof hook !== 'function') {
		throw new TypeError('The "hook" argument must be a function');
	}

	forEachEngine(appName, engineName, function (engine) {
		engine.post.push(hook);
	});
};

/**
 * Removes a post-login hook from an engine, make sure that you are providing the same function
 * instance.
 *
 * @param {string|null}   appName    The appName to target (pass null to target all apps)
 * @param {string|null}   engineName The engine to target (pass null to target all engines)
 * @param {Function}      hook       The hook function
 * @throws Error                     If the appName or engine doesn't exists
 * @return boolean                   False if the hook was not found, true otherwise
 */
exports.unregisterPostLoginHook = function (appName, engineName, hook) {
	// deal with optionality of appName and engineName

	if (typeof appName === 'function') {
		hook = appName;
		appName = null;
	}

	if (typeof engineName === 'function') {
		hook = engineName;
		engineName = null;
	}

	if (typeof hook !== 'function') {
		throw new TypeError('The "hook" argument must be a function');
	}

	var removed = false;

	forEachEngine(appName, engineName, function (engine) {
		var index = engine.post.indexOf(hook);

		while (index !== -1) {
			engine.post.splice(index, 1);
			removed = true;

			index = engine.post.indexOf(hook);
		}
	});

	// return true if we managed to unregister the hook from at least one spot
	return removed;
};
