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
 * @param {Object|string} engine The engine we want to query, if you are an admin, you can use { name: engineName, appName: appName }
 * @param {Object}        params Parameters to give to the engine
 * @param {Function}      cb     A callback that take an error
 * @returns {*}
 */
exports.check = function (state, engine, params, cb) {
	if (typeof engine === 'string') {
		engine = {
			name: engine,
			appName: state.appName
		};
	}

	// if the user is not admin, do not allow overriding the current app
	if (!state.canAccess('admin')) {
		engine.appName = state.appName;
	}

	if (!engine.appName) {
		return state.error('ident', new Error('State does not contain an app'), cb);
	}

	if (!auth[engine.appName]) {
		return state.error('ident', new Error('App ' + engine.appName + ' has no auth configuration'), cb);
	}

	if (!auth[engine.appName][engine.name]) {
		return state.error('ident', new Error('Engine ' + engine.name + ' is not configured for app ' + engine.appName), cb);
	}

	params = params || {};

	// now we can do stuff
	var authEngine = auth[engine.appName][engine.name];
	authEngine.instance.auth(state, params, function (err) {
		if (err) {
			return state.error('ident', err, cb);
		}

		// give the user his actorId
		state.respond(state.session.actorId);

		cb();
	});
};

exports.sendCommand = function (state, engine, command, params, cb) {
	if (typeof engine === 'string') {
		engine = {
			name: engine,
			appName: state.appName
		};
	}

	// if the user is not admin, do not allow overriding the current app
	if (!state.canAccess('admin')) {
		engine.appName = state.appName;
	}

	if (!engine.appName) {
		return state.error('ident', new Error('State does not contain an app'), cb);
	}

	if (!auth[engine.appName]) {
		return state.error('ident', new Error('App ' + engine.appName + ' has no auth configuration'), cb);
	}

	if (!auth[engine.appName][engine.name]) {
		return state.error('ident', new Error('Engine ' + engine.name + ' is not configured for app ' + engine.appName), cb);
	}

	params = params || {};

	// now we can do stuff
	var authEngine = auth[engine.appName][engine.name];

	// or not
	if (!authEngine.instance.run) {
		return state.error('ident', new Error('Engine ' + engine.name + ' does not have any command'), cb);
	}

	authEngine.instance.run(state, command, params, function (err, data) {
		if (err) {
			return state.error('ident', err, cb);
		}

		state.respond(data);

		cb();
	});
};