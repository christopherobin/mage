var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var util = require('util');
var path = require('path');
var async = require('async');

// Detect if the cwd is correct, and if not, move into the path of the mainModule.
// If Mage is imported into an interactive console, process.mainModule is undefined so
// use the current directory instead.

var rootPath;

if (process.mainModule && process.mainModule.filename) {
	rootPath = path.dirname(process.mainModule.filename);
	process.chdir(rootPath);
} else {
	rootPath = process.cwd();
}

/**
 * The mage class.
 *
 * @constructor
 * @extends EventEmitter
 */

function Mage(config) {
	EventEmitter.call(this);

	var that = this;

	this.task = require('../tasks/serve');

	this._runState = 'init';
	this._modulesList = [];
	this._modulePaths = [];

	// Set up the core object that holds some crucial Mage libraries

	var loggedTimeDeprecation = false;

	this.core = {
		modules: {},
		config: config,
		get time() {
			if (!loggedTimeDeprecation && that.core.logger) {
				that.core.logger.warning('mage.core.time has been deprecated, please use the mage.time.now() function from now on');
				loggedTimeDeprecation = true;
			}

			if (that.time) {
				return that.time.now();
			}

			return (Date.now() / 1000) >> 0;
		}
	};

	// Register the Mage version

	var magePath = path.join(path.dirname(__dirname), '..');

	var magePackage = require(path.join(magePath, 'package.json'));
	var packageInfo;

	try {
		packageInfo = require(path.join(rootPath, 'package.json'));
	} catch (e) {}

	var appName = packageInfo && packageInfo.name || path.basename(rootPath);
	var appVersion = packageInfo && packageInfo.version || 'no-version';

	this.version = magePackage.version;

	this.magePackage = {
		name: 'mage',
		version: magePackage.version,
		path: magePath,
		package: magePackage
	};

	this.rootPackage = {
		name: appName,
		version: appVersion,
		path: rootPath,
		package: packageInfo
	};
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
 * Assigns MAGE a new task that will be run when mage.start() is called. Therefore, this must be
 * done before start() is called. It makes sense to assign the task based on commandline arguments
 * which are managed in ./cli.js.
 *
 * @param {Function} fn
 */

Mage.prototype.setTask = function (fn) {
	this.task = fn;
};


/**
 * Sets up core libraries.
 */

Mage.prototype.setupCoreLibs = function () {
	var core = this.core;

	// Set up the logging service and Mage internal logger

	core.loggingService = require('../loggingService');
	core.loggingService.addWriter('terminal', ['>=notice'], {});

	core.logger = core.loggingService.getCreator().context('MAGE');
	core.config = require('../config');
	core.cli = require('../cli');

	// Add other libraries

	core.savvy = require('../savvy');
	core.processManager = require('../processManager');
	core.helpers = require('../helpers');
	core.app = require('../app');
	core.serviceDiscovery = require('../serviceDiscovery');
	core.msgServer = require('../msgServer');
	core.archivist = require('../archivist');
	core.access = require('../access');
	core.cmd = require('../commandCenter');
	core.sampler = require('../sampler');

	// Register classes

	core.State = require('../state').State;
	core.CommandCenterClient = require('../commandCenterClient').CommandCenterClient;

	// Make this chainable.
	return this;
};


/**
 * Shuts mage down, allowing I/O sensitive subsystems to shut down gracefully.
 * This logic applies to Master and Worker processes alike.
 *
 * @param {Boolean} graceful Is this shutdown normal, or due to something bad?
 * @param {Number}  exitCode An exit code for node to return.
 */

Mage.prototype.quit = function (graceful, exitCode) {
	if (this.getRunState() === 'quitting') {
		return;
	}

	var logger = this.core.logger;

	logger.verbose('Shutting down Mage...');

	this.setRunState('quitting');

	this.emit('shutdown');
	this.removeAllListeners('shutdown');

	var archivist = this.core.archivist;
	var pm = this.core.processManager;

	async.series([
		function (callback) {
			archivist.closeVaults();
			callback();
		},
		function (callback) {
			// The following if-statement is required for the case where we do not yet have a
			// process manager (e.g. mage logger is broken)

			if (pm) {
				pm.quit(graceful, callback);
			} else {
				callback();
			}
		}
	], function () {
		logger.notice('Mage shutdown completed, terminating process...');

/*
		var handles = process._getActiveHandles();
		handles.forEach(function (handle) {
			logger.debug(handle.constructor && handle.constructor.name, 'handle active:', handle);
		});

		var requests = process._getActiveRequests();
		requests.forEach(function (req) {
			logger.debug(req.constructor && req.constructor.name, 'request active:', req);
		});
*/
		process.exit(exitCode || 0);
	});
};


/**
 * Logs input arguments and quits mage with code -1.
 */

Mage.prototype.fatalError = function () {
	if (arguments.length > 0) {
		this.core.logger.emergency.apply(this.core.logger, arguments);
	}

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
 * Use a module, either from a path you have specified with `addModulesPath`, or from the modules
 * provided by mage. Modules are searched for in the paths in the order the paths were added, and
 * mage internal modules are search last. This function takes any number of module names as
 * arguments. Module names may be substituted for arrays for module names, so you can mix and match.
 *
 * @return {Object} The mage itself is returned to allow chaining.
 */

Mage.prototype.useModules = function () {
	var modList = [];

	// Construct a list.
	for (var n = 0; n < arguments.length; n++) {
		modList = modList.concat(arguments[n]);
	}

	// Iterate over the arguments.
	for (var i = 0; i < modList.length; i++) {
		var name = modList[i];
		var resolved = null;

		if (typeof name !== 'string') {
			return this.fatalError('Module names must be strings! Given:', name);
		}

		// Check for registered modules with the same name.
		for (var j = 0; j < this._modulesList.length; j++) {
			if (name === this._modulesList[j].name) {
				return this.fatalError('Attempted to add a second module with name:', name);
			}
		}

		// Check for module that resolves in the search paths.
		for (var k = 0; k < this._modulePaths.length; k++) {
			var resolvedPath = path.resolve(this._modulePaths[k], name);

			if (fs.existsSync(resolvedPath)) {
				resolved = resolvedPath;
				break;
			}
		}

		// If no module was found in the search paths, treat it as a mage module.
		if (!resolved) {
			resolved = path.join(__dirname, '..', 'modules', name);
		}

		this._modulesList.push({ name: name, path: resolved });
	}

	return this;
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

		if (mod.name === name) {
			return path.dirname(require.resolve(mod.path));
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
		return mod.name;
	});
};


/**
 * The archivist setup function.
 *
 * @param  {Function} cb Takes only an error as an argument. Used for an `async.series`.
 */

Mage.prototype.setupArchivist = function (cb) {
	this.core.archivist.setup(cb);
};

/**
 * Setup logic for registered modules.
 *
 * @param  {Function} cb Takes only an error as an argument. Used for an `async.series`.
 */

Mage.prototype.setupModules = function (cb) {
	// extract and expose the modules out of this._modulesList which have not yet been set up

	var core = this.core;
	var mod, setupList = [];

	for (var i = 0, len = this._modulesList.length; i < len; i++) {
		var info = this._modulesList[i];
		var modName = info.name;
		var modPath = info.path;

		if (core.modules.hasOwnProperty(modName)) {
			// this module has already been set up and should be ignored
			continue;
		}

		this.core.config.loadModuleConfig(modName, modPath);

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
 * @param {Function}        [cb] An optional callback, called when setup completes. No arguments.
 * @fires Mage:readyToStart
 */

Mage.prototype.setup = function (cb) {
	var that = this;
	var logger = that.core.logger;

	this.setRunState('setup');

	// Set up the logging system according to config.

	function setupLogging(callback) {
		try {
			that.core.loggingService.configure();
		} catch (error) {
			logger.emergency('Fatal configuration error:', error);
			return callback(error);
		}

		callback();
	}

	// Set up the process manager.

	function setupProcessManager(callback) {
		that.core.processManager.setup(callback);
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

		return that.setupModules(callback);
	}

	// Start the process manager (which spawns workers from the master)

	function startProcessManager(callback) {
		that.core.processManager.start(callback);
	}


	// Create the apps

	function createApps(callback) {
		// the master process does not create apps

		if (that.core.processManager.isMaster) {
			return callback();
		}

		that.core.app.createApps();

		if (that.dashboard) {
			that.dashboard.setupDashboardApps(['dev', 'support', 'cms'], callback);
		} else {
			callback();
		}
	}

	// Time to run each step!
	// All errors are treated as fatal.

	async.series([
		setupLogging,
		setupProcessManager,
		setupArchivist,
		setupMsgServer,
		setupSampler,
		setupModules,
		startProcessManager,
		createApps
	], function (error) {
		// Errors are fatal

		if (error) {
			return that.fatalError();
		}

		logger.notice('Mage setup complete.');

		// We do not call "cb" on the master

		if (that.core.processManager.isMaster) {
			return;
		}

		var appMap = that.core.app.getAppMap();

		// The game may now start!

		that.emit('readyToStart', appMap);

		// yield all apps

		if (cb) {
			cb(null, appMap);
		}
	});

	return this;
};


/**
 * @param  {Function} [cb] Optional callback to call when start has completed.
 */

Mage.prototype.start = function (cb) {
	cb = cb || function () {};

	this.task(this, cb);
};


/**
 * Returns the development mode boolean value. Configure this with a config file
 * of the DEVELOPMENT_MODE environment variable (the latter is discouraged).
 *
 * @return {Boolean} If a mage is in development mode, then this returns `true`.
 */

Mage.prototype.isDevelopmentMode = function () {
	return this.core.config.get(['developmentMode']);
};

// Set the module.exports to the mage constructor.
module.exports = Mage;
