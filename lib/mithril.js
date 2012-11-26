var path = require('path'),
    util = require('util'),
    async = require('async'),
    EventEmitter = require('events').EventEmitter;


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
	var ServiceDiscovery = require('./serviceDiscovery').ServiceDiscovery;

	core.deprecator = require('./deprecator');
	core.config = new Config();
	core.processManager = require('./processManager');
	core.helpers = require('./helpers');
	core.app = require('./app');
	core.datatypes = require('./datatypes');
	core.serviceDiscovery = new ServiceDiscovery();
	core.clients = require('./clients');
	core.msgServer = require('./msgServer');
	core.cmd = require('./commandCenter');

	// Register classes

	core.State = require('./state').State;
	core.PropertyMap = require('./propertyMap').PropertyMap;
	core.LivePropertyMap  = require('./livePropertyMap').LivePropertyMap;
};


// Shutdown logic

Mithril.prototype.quit = function (graceful, returnCode) {
	if (this.getRunState() === 'quitting') {
		return;
	}

	this.setRunState('quitting');

	this.core.logger.verbose('Shutting down Mithril...');

	this.emit('shutdown');

	var datasources = require('./datasources');

	var pm = this.core.processManager;

	datasources.close(function () {
		// console.log(process._getActiveHandles());
		// console.log(process._getActiveRequests());

		// This condition is required for the case
		// where we do not have a process manager
		// yet (e.g. mithril logger is broken)
		if (pm) {
			pm.quit(graceful, returnCode);
		} else {
			process.exit(returnCode);
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

			if (error) {
				core.logger.emergency('Mithril setup failed.');
				process.exit(1);
				return;
			}

			core.logger.notice('Mithril setup complete.');

			cb();
		}
	);
};


// mithril.setup() sets up mithril and its modules.
// After this (callback), the app is ready to start the initialization process.
// When that has completed, mithril.start() needs to be called, so users may connect to the service.

Mithril.prototype.setup = function (pathConfig, cb) {
	this.setRunState('setup');

	// read the config file(s)

	try {
		this.core.config.add(pathConfig);
	} catch (e) {
		this.fatalError(e);
	}

	// set up the logging system according to config

	try {
		this.core.loggingService.configure(this.core.config.get('logging.server'));
	} catch (error) {
		this.core.deprecator.trigger('logger');

		this.fatalError('Fatal configuration error:', error);
		return;
	}

	// start the process manager

	this.core.processManager.start();

	// set up the msgServer. This will:
	// - set up a clientHost (HTTP server) for workers and standalone
	// - connect to peers in the network for master and standalone

	this.core.msgServer.setup();

	if (this.core.processManager.isMaster) {
		// master has nothing left to do!
		// we do not call cb on the master
		return;
	}

	this.setupModules(cb);
};


// mithril.start() starts all services that allow users to connect

Mithril.prototype.start = function () {
	this.core.msgServer.startClientHost();

	this.setRunState('running');
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

var mithril = module.exports = new Mithril();

mithril.setupCoreLibs();


// global default settings override

require('http').Agent.defaultMaxSockets = 100;	// max 100 parallel client sockets per agent
