var assert = require('assert');
var mage   = require('../../mage');
var async  = require('async');
var logger = mage.core.logger.context('ident');


/**
 * EntryPoint is a class holding information about an engine, including the instance itself.
 *
 * @param {string} engineName
 * @param {Object} cfg
 * @constructor
 */

function EntryPoint(engineName, cfg) {
	assert.ok(engineName, 'No engine name provided');

	this.engineCfg = cfg.config || {};
	this.driver = require('./engines/' + cfg.type);
	this.type = cfg.type;
	this.engineName = engineName;
	this.engine = undefined;   // run setup(cb) to instantiate engine itself
	this.post = [];

	if (mage.isDevelopmentMode()) {
		this.access = mage.core.access.getHighestLevel();
		logger.debug('Development mode: set ident engine', engineName, 'to', this.access);
	} else if (this.engineCfg.access) {
		logger.warning('[deprecated] The access level is no longer part of the ident engine\'s own configuration, please move it one level up.');
		this.access = this.engineCfg.access;
	} else if (cfg.accesss) {
		this.access = cfg.access;
	} else {
		// if no access level has been configured, default to the lowest level possible (anonymous)

		this.access = mage.core.access.getLowestLevel();
	}
}


EntryPoint.prototype.setup = function (cb) {
	var that = this;

	function callback(error, engine) {
		if (error) {
			return cb(error);
		}

		that.engine = engine;

		cb();
	}

	try {
		this.driver.setup(this.engineName, this.engineCfg, logger.context(this.engineName), callback);
	} catch (error) {
		cb(error);
	}
};


// this map contains entry points by engine name
// { engineName: { EntryPoint } }

var entryPoints = {};
var publicEntryPoints = [];  // entry point information that is safe to share in public

/**
 * Setup an engine based on it's config and return an instance in the callback
 *
 * @param {string}   engineName The name for the engine
 * @param {Object}   cfg        The config, must contain the engine type and the engine config
 * @param {Function} cb         A callback that take an error and an engine instance
 */

function setupEngine(engineName, cfg, cb) {
	var entryPoint = new EntryPoint(engineName, cfg);

	entryPoint.setup(function (error) {
		if (error) {
			return cb(error);
		}

		entryPoints[engineName] = entryPoint;

		publicEntryPoints.push({
			engineName: entryPoint.engineName,
			type: entryPoint.type,
			access: entryPoint.access
		});

		cb();
	});
}


/**
 * Setup the ident system, it will check every modules configured and pre-instantiate every engine
 *
 * @param {State}    state
 * @param {Function} cb
 */

exports.setup = function (state, cb) {
	var engineCfg = mage.core.config.get(['module', 'ident', 'engines'], {});
	var engineNames = Object.keys(engineCfg);

	async.eachSeries(engineNames, function (engineName, cb) {
		setupEngine(engineName, engineCfg[engineName], cb);
	}, function (error) {
		if (error) {
			return state.error('ident', error, cb);
		}

		cb();
	});
};


/**
 * Get an entry point
 *
 * @param {State}  state      The current state, used for access tests
 * @param {string} engineName The engine to target
 * @throws Error              If the entry point is not found or the app is invalid
 * @returns {Object}          The EntryPoint instance
 */

exports.getEntryPoint = function (state, engineName) {
	assert.ok(engineName, 'No engine name provided');
	assert.ok(entryPoints[engineName], 'Engine ' + engineName + ' is not configured');

	return entryPoints[engineName];
};


/**
 * Get an engine
 *
 * @param {State}  state      The current state, used for access tests
 * @param {string} engineName The engine to target
 * @throws Error              If the entry point is not found or the app is invalid
 * @returns {Object}          The Engine instance
 */

exports.getEngine = function (state, engineName) {
	return exports.getEntryPoint(state, engineName).engine;
};


/**
 * Gives the list of all engines without exposing too much information
 *
 * @returns {Object[]}
 */

exports.getPublicEngineList = function () {
	return publicEntryPoints;
};


/**
 * @param {State}    state        The current state
 * @param {string}   engineName   The engine we want to query
 * @param {Object}   credentials  Parameters to give to the engine
 * @param {Object}   control      Parameters to control behavior of the auth process
 * @param {Function} cb           A callback that take an error
 * @returns {*}
 */
exports.check = function (state, engineName, credentials, control, cb) {
	var entryPoint;

	try {
		entryPoint = exports.getEntryPoint(state, engineName);
	} catch (err) {
		return state.error('ident', err, cb);
	}

	// custom access levels and user ID switching are allowed in development mode

	var access = entryPoint.access;
	var asUserId;

	if (mage.isDevelopmentMode()) {
		control = control || {};

		access = control.access || entryPoint.access;
		asUserId = control.userId;
	}

	// authenticate on the engine

	entryPoint.engine.auth(state, credentials || {}, function (error, user) {
		if (error) {
			return cb(error);
		}

		// register a session and store the user information in its meta data

		var meta = {
			access: access,
			user: user
		};

		mage.session.register(state, asUserId || user.userId, null, meta, function (error, session) {
			if (error) {
				return cb(error);
			}

			// run post login hooks

			async.eachSeries(
				entryPoint.post,
				function (hook, callback) {
					hook(state, entryPoint.engineName, user, callback);
				},
				function (error) {
					if (error) {
						return cb(error);
					}

					cb(null, session);
				}
			);
		});
	});
};


/**
 * Runs fn for each occurence of engineName (or all engines) in the config
 *
 * @param {string|null} engineName
 * @param {Function}    fn
 */

function forEachEntryPoint(engineName, fn) {
	// if no engineName was given, apply this function to all engines

	if (!engineName) {
		return Object.keys(entryPoints).forEach(function (engineName) {
			forEachEntryPoint(engineName, fn);
		});
	}

	var entryPoint = entryPoints[engineName];

	assert.ok(entryPoint, 'Engine "' + engineName + '" is not configured');

	fn(entryPoint);
}


/**
 * Register a post-login hook for a given engineName. The hook function is called only on successful
 * login and is provided with the state, engineName and a callback function.
 *
 * If the hook wants to prevent login, it just needs to provide an error to the callback. If no
 * engine name is provided the hook will be added on every engine.
 *
 * If more than one post-login hook is registered, they are run in the order they were registered
 * and the first hook that fails will prevent the other hooks from being run.
 *
 * For example one may want to add a banned status to the user, that can be done by checking in
 * archivist if the session's actorId is banned, and returning an error if it is the case.
 *
 * @param {string|null} engineName The engine to target (pass null to target all engines)
 * @param {Function}    hook       The hook function
 * @throws Error                   If engineName doesn't exist
 */

exports.registerPostLoginHook = function (engineName, hook) {
	// deal with optionality of engineName

	if (typeof engineName === 'function') {
		hook = engineName;
		engineName = null;
	}

	assert.equal(typeof hook, 'function', 'The "hook" argument must be a function');

	forEachEntryPoint(engineName, function (entryPoint) {
		entryPoint.post.push(hook);
	});
};

/**
 * Removes a post-login hook from an engine, make sure that you are providing the same function
 * reference.
 *
 * @param {string|null}   engineName The engine to target (pass null to target all engines)
 * @param {Function}      hook       The hook function
 * @throws Error                     If the engineName doesn't exist
 * @return boolean                   False if the hook was not found, true otherwise
 */

exports.unregisterPostLoginHook = function (engineName, hook) {
	// deal with optionality of engineName

	if (typeof engineName === 'function') {
		hook = engineName;
		engineName = null;
	}

	assert.equal(typeof hook, 'function', 'The "hook" argument must be a function');

	var removed = false;

	forEachEntryPoint(engineName, function (entryPoint) {
		var index = entryPoint.post.indexOf(hook);

		while (index !== -1) {
			entryPoint.post.splice(index, 1);
			removed = true;

			index = entryPoint.post.indexOf(hook);
		}
	});

	// return true if we managed to unregister the hook from at least one spot
	return removed;
};
