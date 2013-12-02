var mage   = require('../../mage');
var async  = require('async');
var logger = mage.core.logger.context('ident');

// list the apps with their individual auth engine instances
var auth = {};

/**
 * Setup an engine based on it's config and return an instance in the callback
 *
 * @param {string}   app  The app name
 * @param {string}   name The name for the engine
 * @param {Object}   cfg  The config, must contain the engine type and the engine config
 * @param {Function} cb   A callback that take an error and an engine instance
 */
function setupEngine(app, name, cfg, cb) {
	var engine;

	try {
		// try to require it
		engine = require('./engines/' + cfg.type);
	} catch (error) {
		return cb(new Error('Could not load auth engine ' + cfg.type));
	}

	if (!auth[app]) {
		auth[app] = {};
	}

	var engineCfg = cfg.config || {};

	// if no access level is defined by the engine, get it from the app or default on the lowest
	// level available
	if (!engineCfg.access) {
		// get the app config
		var appAccess = mage.core.config.get(['apps', app, 'access']);
		engineCfg.access = appAccess || mage.core.access.getLowestLevel();

	}

	engine.setup(engineCfg, logger.context(name).context(cfg.type), function (err, instance) {
		if (err) {
			return cb(err);
		}

		auth[app][name] = {
			type: cfg.type,
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
			setupEngine(appName, engineName, cfg[appName][engineName], cb);
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
 * @param {State}         state  The current state
 * @param {Object|string} engine Whether an engine name (will search on current app) or an object in
 *                               the form { appName: "app", name: "engine name" }
 * @throws Error if the engine is not found or the app is invalid
 * @returns {Object} The authentication engine
 */
exports.getEngine = function (state, engine) {
	if (typeof engine === 'string') {
		engine = {
			name: engine,
			appName: state.appName
		};
	}

	// if the user is not admin, do not allow overriding the current app
	if ((engine.appName !== state.appName) && !state.canAccess('admin')) {
		throw new Error('User ' + state.actorId + ' tried to access an engine on app "'
			+ engine.appName + '" from app "' + state.appName + '" but does not have admin rights.');
	}

	if (!engine.appName) {
		throw new Error('No app name provided');
	}

	if (!auth[engine.appName]) {
		throw new Error('App ' + engine.appName + ' has no auth configuration');
	}

	if (!auth[engine.appName][engine.name]) {
		throw new Error('Engine ' + engine.name + ' is not configured for app ' + engine.appName);
	}

	return auth[engine.appName][engine.name];
};

/**
 * Gives the list of engines for the current state
 *
 * @param {string}   appName The appName whose config we want to get
 * @param {Function} cb      A user command callback
 * @returns {*}
 */
exports.getEngines = function (appName, cb) {
	var engines = {};

	if (auth[appName]) {
		var engineNames = Object.keys(auth[appName]);
		for (var i = 0; i < engineNames.length; i++) {
			var engineName = engineNames[i];

			// add engine name with type
			engines[engineName] = auth[appName][engineName].type;
		}
	}

	cb(null, engines);
};

/**
 *
 * @param {State}         state  The current state
 * @param {Object|string} engine The engine we want to query, if your session has admin rights, you can use { name: engineName, appName: appName }
 * @param {Object}        params Parameters to give to the engine
 * @param {Function}      cb     A callback that take an error
 * @returns {*}
 */
exports.check = function (state, engine, params, cb) {
	var authEngine;

	try {
		authEngine = exports.getEngine(state, engine);
	} catch (err) {
		return state.error('ident', err, cb);
	}

	params = params || {};

	// now we can do stuff
	authEngine.instance.auth(state, params, function (err) {
		if (err) {
			return state.error('ident', err, cb);
		}

		// run the post-login hooks if there are any
		async.applyEachSeries(authEngine.post, state, function (err) {
			if (err) {
				// unregister session
				state.session.expire(state);

				// then log the error
				return state.error('ident', err, cb);
			}

			// give the user his actorId
			state.respond(state.session.actorId);

			cb();
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

	params = params || {};

	authEngine.instance.run(state, command, params, function (err, data) {
		if (err) {
			return state.error('ident', err, cb);
		}

		state.respond(data);

		cb();
	});
};

/**
 * Register a post-login hook for a given appName and engine, the hook function is called only on
 * successful login and is provided with the state and a callback function, if the hook want to
 * prevent login, it just needs to provide an error to the callback. If no engine name is provided
 * the hook is added on every engines for that app
 *
 * If more than one post-login hook is registered, they are run in the order they were registered
 * and the first hook that fails will prevent the other hooks from being run.
 *
 * For example one may want to add a banned status to the user, that can be done by checking in
 * archivist if the session actorId is banned, and returning an error if it is the case.
 *
 * @param {string}   appName      The appName the hook target
 * @param {string}   [engineName] The engine to target
 * @param {Function} hook         The hook function
 * @throws Error If the appName or engineName doesn't exists
 */
exports.registerPostLoginHook = function (appName, engineName, hook) {
	if (typeof engineName === 'function') {
		hook = engineName;
		engineName = null;
	}

	if (!auth[appName]) {
		throw new Error('App ' + appName + ' has no auth configuration');
	}

	var engineNames = [];
	if (engineName) {
		if (!auth[appName][engineName]) {
			throw new Error('Engine ' + engineName + ' is not configured for app ' + appName);
		}

		engineNames = [engineName];
	} else {
		// just get every engines for that app
		engineNames = Object.keys(auth[appName]);
	}

	// just add the hook to the engine(s)
	for (var i = 0; i < engineNames.length; i++) {
		auth[appName][engineNames[i]].post.push(hook);
	}
};

/**
 * Removes a post-login hook from an engine, make sure that you are providing the same function
 * instance.
 *
 * @param {string}   appName      The appName the hook target
 * @param {string}   [engineName] The engine to target
 * @param {Function} hook         The hook function
 * @throws Error If the appName or engine doesn't exists
 * @return boolean False if the hook was not found, true if it was removed successfully
 */
exports.unregisterPostLoginHook = function (appName, engineName, hook) {
	if (typeof engineName === 'function') {
		hook = engineName;
		engineName = null;
	}

	if (!auth[appName]) {
		throw new Error('App ' + appName + ' has no auth configuration');
	}

	var engineNames = [];
	if (engineName) {
		if (!auth[appName][engineName]) {
			throw new Error('Engine ' + engineName + ' is not configured for app ' + appName);
		}

		engineNames = [engineName];
	} else {
		// just get every engines for that app
		engineNames = Object.keys(auth[appName]);
	}

	var removed = false;
	for (var i = 0; i < engineNames.length; i++) {
		engineName = engineNames[i];

		// try to remove the hook
		var hookIndex = auth[appName][engineName].post.indexOf(hook);

		// not found, or wrong instance
		if (hookIndex === -1) {
			continue;
		}

		// splice it out
		auth[appName][engineName].post.splice(hookIndex, 1);

		// we removed the engine from at least one spot
		removed = true;
	}

	// return true if we managed to unregister the engine from at least one spot
	return removed;
};
