var mage   = require('../../mage');
var async  = require('async');
var logger = mage.core.logger.context('ident');
var path   = require('path');

// load some default for the dashboard auth (maybe move that to the dashboard itself?)
mage.core.config.setTopLevelDefault(['module', 'ident'], path.join(__dirname, 'config.yaml'));

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
	var cfg = mage.core.config.get(['module', 'ident']) || {};

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
 * @param {State}    state The current state
 * @param {Function} cb    A user command callback
 * @returns {*}
 */
exports.getEngines = function (state, cb) {
	if (!state.appName) {
		return cb(new Error('State does not contain an appName'));
	}

	var engines = {};

	if (auth[state.appName]) {
		var engineNames = Object.keys(auth[state.appName]);
		for (var i = 0; i < engineNames.length; i++) {
			var engineName = engineNames[i];

			// add engine name with type
			engines[engineName] = auth[state.appName][engineName].type;
		}
	}

	cb(null, engines);
};

/**
 *
 * @param {State}    state  The current state
 * @param {string}   engine The engine we want to query
 * @param {Object}   params Parameters to give to the engine
 * @param {Function} cb     A callback that take an error
 * @returns {*}
 */
exports.check = function (state, engine, params, cb) {
	if (!state.appName) {
		return state.error('ident', new Error('State does not contain an app'), cb);
	}

	if (!auth[state.appName]) {
		return state.error('ident', new Error('App ' + state.appName + ' has no auth configuration'), cb);
	}

	if (!auth[state.appName][engine]) {
		return state.error('ident', new Error('Engine ' + engine + ' is not configured for app ' + state.appName), cb);
	}

	params = params || {};

	// now we can do stuff
	var authEngine = auth[state.appName][engine];
	authEngine.instance.auth(state, params, function (err) {
		if (err) {
			return state.error('ident', err, cb);
		}

		cb();
	});
};
