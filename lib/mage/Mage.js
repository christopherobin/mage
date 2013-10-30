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

	this.task = null;

	this._runState = 'init';
	this._modulesList = [];
	this._modulePaths = [];

	// Set up the core object that holds some crucial Mage libraries

	this.core = {
		modules: {},
		time: null,
		config: config
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
 * Assigns MAGE a new task that will be run when mage.setup() and mage.start() are called.
 * Therefore, this must be done before setup() is called. It makes sense to assign the task based on
 * commandline arguments which are managed in ./cli.js.
 *
 * @param {string}   name       The name of a task, which should be requireable in the lib/tasks folder
 * @param {*}        [options]  An options argument to pass on the task's setup and start functions
 */

Mage.prototype.setTask = function (name, options) {
	this.task = {
		name: name,
		options: options
	};
};


/**
 * Returns an object containing a setup and start function that each accept a single callback. They
 * decorate the tasks implemented setup and start functions (both optional) which accept three
 * arguments: mage, options, cb. The options argument comes from the options that were passed when
 * setTask was called.
 *
 * If no task was assigned, undefined is returned.
 *
 * @returns {Object}
 */

Mage.prototype.getTask = function () {
	if (!this.task) {
		return;
	}

	var mage = this;
	var name = this.task.name;
	var options = this.task.options;

	var api = require('../tasks/' + name);

	return {
		setup: function (cb) {
			if (api.setup) {
				api.setup(mage, options, cb);
			} else {
				cb();
			}
		},
		start: function (cb) {
			if (api.start) {
				api.start(mage, options, cb);
			} else {
				cb();
			}
		}
	};
};


/**
 * Sets up core libraries.
 */

Mage.prototype.setupCoreLibs = function () {
	var core = this.core;

	// Set up the logging service and Mage internal logger

	var loggingService = require('../loggingService');

	core.loggingService = loggingService;
	core.logger = loggingService.getCreator().context('MAGE');

	// We immediately run CLI, so that verbose mode can be turned on if needed. CLI has no require-
	// time dependencies outside of access to mage.setTask

	core.cli = require('../cli');
	core.cli.run();

	// Set up the logger with a nice default before we have access to config

	loggingService.addWriter('terminal', ['>=notice'], {});

	core.config = require('../config');

	// Register classes

	core.State = require('../state').State;
	core.CommandCenterClient = require('../commandCenterClient').CommandCenterClient;

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

	var archivist = this.core.archivist;
	var pm = this.core.processManager;

	archivist.closeVaults();

	// console.log(process._getActiveHandles());
	// console.log(process._getActiveRequests());

	if (pm) {
		pm.quit(graceful, exitCode);
	} else {
		logger.notice('Mage shutdown completed without process manager access, terminating process...');

		process.exit(exitCode || 0);
	}
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

	// Construct a list (use Array#concat, so that an argument can be both an array and a string)
	for (var n = 0; n < arguments.length; n++) {
		modList = modList.concat(arguments[n]);
	}

	// Iterate over the arguments
	for (var i = 0; i < modList.length; i++) {
		var name = modList[i];
		var resolved = null;

		if (typeof name !== 'string') {
			return this.fatalError('Module names must be strings! Given:', name);
		}

		// Check for registered modules with the same name
		for (var j = 0; j < this._modulesList.length; j++) {
			if (name === this._modulesList[j].name) {
				continue;
			}
		}

		// Check for module that resolves in the search paths
		for (var k = 0; k < this._modulePaths.length; k++) {
			var resolvedPath = path.resolve(this._modulePaths[k], name);

			if (fs.existsSync(resolvedPath)) {
				resolved = resolvedPath;
				break;
			}
		}

		// If no module was found in the search paths, treat it as a mage module
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
 * Setup logic for registered modules.
 *
 * @param  {Function} cb Takes only an error as an argument. Used for an `async.series`.
 */

Mage.prototype.setupModules = function (cb) {
	// extract and expose the modules out of this._modulesList which have not yet been set up

	var core = this.core;
	var mod, setupList = [];

	// If during the require() of one module, other modules are added through useModules, this
	// array will grow. This is perfectly safe, and should stay guaranteed. For that reason, the
	// next loop may NOT be changed to include a "len" variable.

	for (var i = 0; i < this._modulesList.length; i++) {
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

	var task = this.getTask();

	if (!task) {
		this.setTask('serve', null);
		task = this.getTask();
	}

	this.setRunState('setup');

	task.setup(function (error, options) {
		// Errors are fatal

		if (error) {
			return that.fatalError();
		}

		options = options || {};

		if (!options.allowUserCallback) {
			return that.start();
		}

		// The user is now responsible for calling mage.start()

		// yield all apps to the readyToStart event and the user callback (if there is one)

		var appMap = that.core.app.getAppMap();

		that.emit('readyToStart', appMap);

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
	var that = this;

	var task = this.getTask();

	task.start(function (error, options) {
		if (error) {
			return that.fatalError();
		}

		options = options || {};

		if (options.allowUserCallback && cb) {
			cb();
		}

		if (options.shutdown) {
			that.quit(true);
		}
	});

	return this;
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


