/** @module  mage */

var path = require('path');
var util = require('util');
var async = require('async');
var EventEmitter = require('events').EventEmitter;

var mage;

// Detect if the cwd is correct, and if not, move into the path of the mainModule.
// If Mage is imported into an interactive console, process.mainModule is undefined so
// use the current directory instead.

var rootPath = path.dirname(process.mainModule && process.mainModule.filename || process.cwd());

if (process.cwd() !== rootPath) {
	process.chdir(rootPath);
}


/**
 * The mage class.
 *
 * @constructor
 * @extends EventEmitter
 */

function Mage() {
	EventEmitter.call(this);

	this._runState = 'init';
	this._modulesList = [];
	this._modulePaths = [];

	// Set up the core object that holds some crucial Mage libraries

	this.core = {
		modules: {},
		commandCenters: {},
		time: null
	};

	// Register the Mage version

	var magePackage = require(path.join(path.dirname(__dirname), 'package.json'));
	var packageInfo;

	try {
		packageInfo = require(path.join(rootPath, 'package.json'));
	} catch (e) {
	}

	var appName = packageInfo && packageInfo.name || path.basename(rootPath);
	var appVersion = packageInfo && packageInfo.version || 'no-version';

	this.version = magePackage.version;
	this.rootPackage = {
		name: appName,
		version: appVersion
	};

	// Start the clock

	this.startClock();
}

util.inherits(Mage, EventEmitter);


/**
 * Requiring Mage's dependencies into games.
 *
 * @param  {String} packageName Package to require.
 * @return {Object|Function} The content of the module.
 */

Mage.prototype.require = function (packageName) {
	return require(packageName);
};


/**
 * Returns the current run state of mage.
 *
 * @return {String} The current run state of mage.
 */

Mage.prototype.getRunState = function () {
	return this._runState;
};


/**
 * Sets mage to a new run state.
 *
 * @param {String} state A new run state to set the mage to.
 */

Mage.prototype.setRunState = function (state) {
	this._runState = state;

	this.emit('runState', state);
};


/**
 * Sets up core libraries.
 */

Mage.prototype.setupCoreLibs = function () {
	var core = this.core;

	// Set up the logging service and Mage internal logger

	core.loggingService = require('./loggingService');
	core.loggingService.addWriter('terminal', ['>=notice'], {});

	core.logger = core.loggingService.getCreator().context('MAGE');

	// Add other libraries

	var Config = require('./config').Config;

	core.deprecator = require('./deprecator');
	core.config = new Config();
	core.processManager = require('./processManager');
	core.helpers = require('./helpers');
	core.app = require('./app');
	core.datatypes = require('./datatypes');
	core.serviceDiscovery = require('./serviceDiscovery');
	core.clients = require('./clients');
	core.msgServer = require('./msgServer');
	core.archivist = require('./archivist');
	core.cmd = require('./commandCenter');

	// Register classes

	core.State = require('./state').State;
	core.PropertyMap = require('./propertyMap').PropertyMap;
	core.LivePropertyMap  = require('./livePropertyMap').LivePropertyMap;
	core.sampler = require('./sampler');
};


/**
 * Shuts mage down.
 *
 * @param {Boolean} graceful Is this shutdown normal, or due to something bad?
 * @param {Number}  exitCode An exit code for node to return.
 */

Mage.prototype.quit = function (graceful, exitCode) {
	if (this.getRunState() === 'quitting') {
		return;
	}

	this.setRunState('quitting');

	this.core.logger.verbose('Shutting down Mage...');

	// allow depending libraries to gracefully clean up

	this.emit('shutdown');

	// shutdown all data sources

	var datasources = require('./datasources');

	var pm = this.core.processManager;
	var logger = this.core.logger;

	datasources.close(function () {
		// console.log(process._getActiveHandles());
		// console.log(process._getActiveRequests());

		// The following if-statement is required for the case where we do not yet have a
		// process manager (e.g. mage logger is broken)

		logger.notice('Mage shutdown completed, terminating process');

		if (pm) {
			pm.quit(graceful, function () {
				process.exit(exitCode || 0);
			});
		} else {
			process.exit(exitCode);
		}
	});
};


/**
 * Logs input arguments and quits mage with code -1.
 */

Mage.prototype.fatalError = function () {
	this.core.logger.emergency.apply(this.core.logger, arguments);
	this.quit(false, -1);
};


/**
 * Add a search path per argument for modules. Add the most important first.
 *
 * @param  {String} modPath A path to some modules.
 * @return {Object}         The mage itself is returned to allow chaining.
 */

Mage.prototype.addModulesPath = function (modPath) {
	this._modulePaths.push(path.resolve(rootPath, modPath));
	return this;
};


/**
 * DEPRECATED
 *
 * With useModule you can tell mage which core modules you want it to use.
 *
 * This method is deprecated, please use `useModules` to register both game and core modules.
 *
 * @param  {String} name Name of the module to add.
 * @return {Object}      The mage itself is returned to allow chaining.
 * @deprecated
 */

Mage.prototype.useModule = function (name) {
	this.core.deprecator.trigger('useModule');
	this.useModules(name);
	return this;
};


/**
 * Use a module, either from a path you have specified with `addModulesPath`, or from the modules
 * provided by mage. Modules are searched for in the paths in the order the paths were added, and
 * mage internal modules are search last. This function takes any number of module names as
 * arguments.
 *
 * @return {Object} The mage itself is returned to allow chaining.
 */

Mage.prototype.useModules = function () {
	// Iterate over the arguments.
	for (var i = 0; i < arguments.length; i++) {
		var name = arguments[i];
		var resolved = null;

		// Check for registered modules with the same name.
		for (var j = 0; j < this._modulesList.length; j++) {
			if (name === this._modulesList[j][0]) {
				return this.fatalError('Attempted to add a second module with name:', name);
			}
		}

		// Check for module that resolves in the search paths.
		for (var k = 0; k < this._modulePaths.length; k++) {
			try {
				resolved = require.resolve(path.resolve(this._modulePaths[k], name));
				break;
			} catch (e) {}
		}

		// If no module was found in the search paths, treat it as a mage module.
		if (!resolved) {
			resolved = './modules/' + name;
		}

		this._modulesList.push([name, resolved]);
	}

	return this;
};


/**
 * DEPRECATED.
 *
 * With addModule you can tell mage which game modules you want it to use. Pass in the name to
 * register the module to, and the path to where the module is located.
 *
 * This method is deprecated, please use `addModulesPath` and `useModules` to register both game
 * and core modules.
 *
 * @param  {String} name    The name of the module to add.
 * @param  {String} modPath The path to the module.
 * @return {Object}         The mage itself is returned to allow chaining.
 * @deprecated
 */

Mage.prototype.addModule = function (name, modPath) {
	this.core.deprecator.trigger('addModule');

	// resolve the path to a full path relative to rootPath

	modPath = path.resolve(rootPath, modPath);

	// register the module

	this._modulesList.push([name, modPath]);
};


/**
 * Returns the path of a module registered with mage under a given name.
 *
 * @param  {String}      name Module name.
 * @return {String|Null}      Path to the module. Returns null if the module name is not registered.
 */

Mage.prototype.getModulePath = function (name) {
	for (var i = 0, len = this._modulesList.length; i < len; i++) {
		var mod = this._modulesList[i];

		if (mod[0] === name) {
			return path.dirname(require.resolve(mod[1]));
		}
	}

	return null;
};


/**
 * Returns all registered module names, in registered order
 *
 * @return {Array} A list of modules, in order of registration.
 */
Mage.prototype.listModules = function () {
	return this._modulesList.map(function (mod) {
		return mod[0];
	});
};


Mage.prototype.setupArchivist = function (cb) {
	var logger = this.core.logger;

	var cfg = this.core.config.get('archivist');
	if (!cfg) {
		this.core.logger.warning('No archivist configuration, skipping set up.');
		return cb();
	}

	try {
		if (!cfg.vaults) {
			logger.emergency('No "vaults" defined in the archivist configuration');
		}

		if (!cfg.listOrder) {
			throw new Error('No "listOrder"-array defined in the archivist configuration');
		}

		if (!cfg.readOrder) {
			throw new Error('No "readOrder"-array defined in the archivist configuration');
		}

		if (!cfg.writeOrder) {
			throw new Error('No "writeOrder"-array defined in the archivist configuration');
		}

		this.core.archivist.registerListOrder(cfg.listOrder);
		this.core.archivist.registerReadOrder(cfg.readOrder);
		this.core.archivist.registerWriteOrder(cfg.writeOrder);
	} catch (roError) {
		logger.emergency(roError);
		return cb(roError);
	}

	// grab the APIs

	var topics = require(path.join(rootPath, 'lib/archivist'));
	this.core.archivist.registerTopics(topics);

	// create the vaults

	this.core.archivist.createVaults(cfg.vaults, cb);
};


Mage.prototype.setupModules = function (cb) {
	// extract and expose the modules out of this._modulesList which have not yet been set up

	var core = this.core;
	var mod, setupList = [];

	for (var i = 0, len = this._modulesList.length; i < len; i++) {
		var info = this._modulesList[i];
		var modName = info[0];
		var modPath = info[1];

		if (core.modules.hasOwnProperty(modName)) {
			// this module has already been set up and should be ignored
			continue;
		}

		// expose the module

		core.logger.verbose('Exposing module', modName);

		mod = require(modPath);

		this[modName] = core.modules[modName] = mod;

		if (mod.setup) {
			setupList.push(modName);
		}
	}

	// set up modules

	var state = new core.State();

	async.forEachSeries(
		setupList,
		function (modName, callback) {
			core.logger.verbose('Setting up module', modName);

			core.modules[modName].setup(state, callback);
		},
		function (error) {
			state.close();

			cb(error);
		}
	);
};


/**
 * Sets up mage and its modules. Listen for the `'readyToStart'` event, or pass in a callback.
 *
 * @param {String|Array} pathConfig A path, or array of paths, to config files.
 * @param {Function}     [cb]       An optional callback, called when setup completes. No arguments.
 * @fires Mage:readyToStart
 */

Mage.prototype.setup = function (pathConfig, cb) {
	if (!pathConfig) {
		return this.fatalError('Mage.setup requires a config file.');
	}

	var that = this;
	var logger = that.core.logger;

	this.setRunState('setup');

	// Read the config file(s).

	function setupConfig(callback) {
		try {
			that.core.config.add(pathConfig);
		} catch (error) {
			logger.emergency(error);
			return callback(error);
		}

		callback();
	}

	// Set up the logging system according to config.

	function setupLogging(callback) {
		try {
			that.core.loggingService.configure(that.core.config.get('logging.server'));
		} catch (error) {
			that.core.deprecator.trigger('logger');

			logger.emergency('Fatal configuration error:', error);
			return callback(error);
		}

		callback();
	}

	// Set up the process manager.

	function setupProcessManager(callback) {
		that.core.processManager.setup();
		callback();
	}


	// Set up the archivist

	function setupArchivist(callback) {
		that.setupArchivist(callback);
	}

	// Set up the msgServer. This will:
	// - set up a clientHost (HTTP server) for workers and standalone
	// - connect to peers in the network for master and standalone

	function setupMsgServer(callback) {
		that.core.msgServer.setup(callback);
	}

	// Set up the sampler.

	function setupSampler(callback) {
		that.core.sampler.setup(callback);
	}

	// Set up the modules

	function setupModules(callback) {
		// the master process does not set up modules

		if (that.core.processManager.isMaster) {
			return callback();
		}

		that.setupModules(function (error) {
			if (error) {
				logger.notice('Mage setup failed.');
				return callback(error);
			}

			logger.notice('Mage setup complete.');
			callback();
		});
	}

	// Start the process manager (which spawns workers from the master)

	function startProcessManager(callback) {
		that.core.processManager.start(callback);
	}


	// Time to run each step!
	// All errors are treated as fatal.

	async.series([
		setupConfig,
		setupLogging,
		setupProcessManager,
		setupArchivist,
		setupMsgServer,
		setupSampler,
		setupModules,
		startProcessManager
	], function (error) {
		// Errors are fatal

		if (error) {
			return that.fatalError(error);
		}

		// We do not call "cb" on the master

		if (that.core.processManager.isMaster) {
			return;
		}

		// The game may now start!

		that.emit('readyToStart');

		if (cb) {
			cb();
		}
	});

	return this;
};


/**
 * Starts all services that allow users to connect
 *
 * @param  {Function} [cb] Optional callback to call when start has completed.
 */

Mage.prototype.start = function (cb) {

	function expose(app, callback) {
		app.exposeOnClientHost(callback);
	}

	var that = this;

	async.forEachSeries(this.core.app.getAppList(), expose, function (error) {
		if (error) {
			// Errors are fatal
			return that.fatalError(error);
		}

		that.core.msgServer.startClientHost(function (error) {
			if (error) {
				// Errors are fatal
				return that.fatalError(error);
			}

			that.setRunState('running');

			if (cb) {
				cb();
			}
		});
	});
};


/**
 * Starts the built-in clock (core.time)
 */

Mage.prototype.startClock = function () {
	// Updated every second

	var core = this.core;

	function updateTime() {
		var currentTime = Date.now();

		core.time = (currentTime / 1000) << 0;	// round down

		setTimeout(updateTime, 1000 - (currentTime % 1000));
	}

	updateTime();
};


// Create Mage and override the exported API of this module

mage = module.exports = new Mage();

mage.setupCoreLibs();

// first do a daemon check

require('./daemon');

// global default settings override

require('http').Agent.defaultMaxSockets = 100;	// max 100 parallel client sockets per agent
