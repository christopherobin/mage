var path = require('path'),
    util = require('util'),
    async = require('async'),
    EventEmitter = require('events').EventEmitter;

var mithril;

// Detect if the cwd is correct, and if not, move into the path of the mainModule.
// If Mithril is imported into an interactive console, process.mainModule is undefined so
// use the current directory instead.

var rootPath = path.dirname(process.mainModule && process.mainModule.filename || process.cwd());

if (process.cwd() !== rootPath) {
	process.chdir(rootPath);
}


// The Mithril class

function Mithril() {
	EventEmitter.call(this);

	this._runState = 'init';
	this._modulesList = [];

	// Set up the core object that holds some crucial Mithril libraries

	this.core = {
		modules: {},
		commandCenters: {},
		time: null
	};

	// Register the Mithril version

	var mithrilPackage = require(path.join(path.dirname(__dirname), 'package.json'));
	var packageInfo;

	try {
		packageInfo = require(path.join(rootPath, 'package.json'));
	} catch (e) {
	}

	var appName = packageInfo && packageInfo.name || path.basename(rootPath);
	var appVersion = packageInfo && packageInfo.version || 'no-version';

	this.version = mithrilPackage.version;
	this.rootPackage = {
		name: appName,
		version: appVersion
	};

	// Start the clock

	this.startClock();
}

util.inherits(Mithril, EventEmitter);


// Run state

Mithril.prototype.getRunState = function () {
	return this._runState;
};


Mithril.prototype.setRunState = function (state) {
	this._runState = state;

	this.emit('runState', state);
};


// Core libraries set up

Mithril.prototype.setupCoreLibs = function () {
	var core = this.core;

	// Set up the logging service and Mithril internal logger

	core.loggingService = require('./loggingService');
	core.loggingService.addWriter('terminal', ['>=notice'], {});

	core.logger = core.loggingService.getCreator();

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
	core.cmd = require('./commandCenter');

	// Register classes

	core.State = require('./state').State;
	core.PropertyMap = require('./propertyMap').PropertyMap;
	core.LivePropertyMap  = require('./livePropertyMap').LivePropertyMap;
	core.sampler = require('./sampler');
};


// Shutdown logic

Mithril.prototype.quit = function (graceful, exitCode) {
	if (this.getRunState() === 'quitting') {
		return;
	}

	this.setRunState('quitting');

	this.core.logger.verbose('Shutting down Mithril...');

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
		// process manager (e.g. mithril logger is broken)

		logger.notice('Mithril shutdown completed, terminating process');

		if (pm) {
			pm.quit(graceful, function () {
				process.exit(exitCode || 0);
			});
		} else {
			process.exit(exitCode);
		}
	});
};


Mithril.prototype.fatalError = function () {
	this.core.logger.emergency.apply(this.core.logger, arguments);
	this.quit(false, -1);
};


// useModule allows you to use built-in modules

Mithril.prototype.useModule = function (name) {
	this._modulesList.push([name, './modules/' + name]);
};


// addModule allows you to add custom modules

Mithril.prototype.addModule = function (name, modPath) {
	// resolve the path to a full path relative to rootPath

	modPath = path.resolve(rootPath, modPath);

	// register the module

	this._modulesList.push([name, modPath]);
};


Mithril.prototype.getModulePath = function (name) {
	for (var i = 0, len = this._modulesList.length; i < len; i++) {
		var mod = this._modulesList[i];

		if (mod[0] === name) {
			return path.dirname(require.resolve(mod[1]));
		}
	}

	return null;
};


// listModules returns all registered module names, in registered order

Mithril.prototype.listModules = function () {
	return this._modulesList.map(function (mod) {
		return mod[0];
	});
};


Mithril.prototype.setupModules = function (cb) {
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


// mithril.setup() sets up mithril and its modules.
// After this (callback), the app is ready to start the initialization process.
// When that has completed, mithril.start() needs to be called, so users may connect to the service.

Mithril.prototype.setup = function (pathConfig, cb) {
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
				logger.notice('Mithril setup failed.');
				return callback(error);
			}

			logger.notice('Mithril setup complete.');
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
		setupMsgServer,
		setupSampler,
		setupModules,
		startProcessManager
	], function (error) {
		// Errors are fatal

		if (error) {
			that.quit(false, -1);
			return;
		}

		// We do not call "cb" on the master

		if (that.core.processManager.isMaster) {
			return;
		}

		// The game may now start!

		cb();
	});
};


// mithril.start() starts all services that allow users to connect

Mithril.prototype.start = function (cb) {
	var that = this;

	this.core.msgServer.startClientHost(function (error) {
		// Errors are fatal

		if (error) {
			that.quit(false, -1);
			return;
		}

		that.setRunState('running');

		if (cb) {
			cb();
		}
	});
};


// startClock starts the built-in clock (core.time)

Mithril.prototype.startClock = function () {
	// Updated every second

	var core = this.core;

	function updateTime() {
		var currentTime = Date.now();

		core.time = (currentTime / 1000) << 0;	// round down

		setTimeout(updateTime, 1000 - (currentTime % 1000));
	}

	updateTime();
};


// Create Mithril and override the exported API of this module

mithril = module.exports = new Mithril();

mithril.setupCoreLibs();

// first do a daemon check

require('./daemon');

// global default settings override

require('http').Agent.defaultMaxSockets = 100;	// max 100 parallel client sockets per agent
