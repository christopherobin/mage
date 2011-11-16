var path = require('path'),
    async = require('async'),
    fs = require('fs'),
    http = require('http'),
    Logger = require('./logger').Logger,
    EventEmitter = require('events').EventEmitter,
    CommandCenter = require('./commandCenter').CommandCenter,
    ServiceDiscovery = require('./serviceDiscovery').ServiceDiscovery;

var config = null, clusterServer = null;


// setting up the logger

var logger = new Logger();

logger.setContext('error');
logger.setContext('info');
logger.setContext('debug', 'void');

process.on('uncaughtException', function (error) {
	logger.error(error.stack);
});


// detect if the cwd is correct, and if not, move into the path of the mainModule.

var rootPath = path.dirname(process.mainModule.filename);

if (process.cwd() !== rootPath) {
	process.chdir(rootPath);
}


// turn Mithril into an EventEmitter

exports.__proto__ = new EventEmitter();


// shutdown logic

var shutdown = false;

var quit = exports.quit = function (graceful, returnCode) {
	function killProcess() {
		if (clusterServer && clusterServer.isMaster) {
			logger.info('Destroying remaining worker processes...');
			clusterServer.destroy();
		}

		logger.info('Shutdown.');

		process.exit(returnCode || 0);
	}

	logger.info('Shutting down Mithril...');

	if (graceful) {
		if (!shutdown) {
			shutdown = true;

			if (clusterServer && clusterServer.isMaster) {
				logger.info('Sending kill signal to worker processes...');
				clusterServer.kill();

				setTimeout(killProcess, 4000);
			} else {
				setTimeout(killProcess, 3000);
			}

			exports.emit('shutdown');
		}
	} else {
		if (!shutdown) {
			exports.emit('shutdown');
		}

		killProcess();
	}
};


function fatalError() {
	logger.error.apply(logger, arguments);
	quit(false, -1);
};

exports.fatalError = fatalError;


// signal handling

process.on('SIGINT', function () {
	logger.info('Caught SIGINT.');
	quit(false);
});

process.on('SIGTERM', function () {
	logger.info('Caught SIGTERM.');
	quit(true);
});


// core libraries

exports.core = {
	modules: {},
	commandCenters: {},
	logger: logger
};

exports.core.helpers          = require('./helpers');
exports.core.State            = require('./state').State;
exports.core.PropertyMap      = require('./propertyMap').PropertyMap;
exports.core.LivePropertyMap  = require('./livePropertyMap').LivePropertyMap;
exports.core.datatypes        = require('./datatypes');
exports.core.serviceDiscovery = new ServiceDiscovery();
exports.core.msgServer        = require('./msgServer');
exports.core.clients          = require('./clients');

exports.isMaster = false;
exports.isWorker = false;

var msgServer = exports.core.msgServer;


// requiring Mithril modules

var modules = [];


exports.useModule = function (name) {
	modules.push([name, './modules/' + name]);
};


exports.addModule = function (name, modPath) {
	// adding custom game-specific modules

	// resolve the path to a full path relative to rootPath

	modPath = path.resolve(rootPath, modPath);

	// register the module

	modules.push([name, modPath]);
};


exports.getModulePath = function (name) {
	for (var i = 0, len = modules.length; i < len; i++) {
		var mod = modules[i];

		if (mod[0] === name) {
			return path.dirname(require.resolve(mod[1]));
		}
	}

	return null;
};


// configuration value shortcut function, returns null if not found.

exports.getConfig = function (path) {
	var cfg = config;

	if (!cfg) {
		return null;
	}

	path = path.split('.');

	for (var i = 0, len = path.length; i < len; i++) {
		cfg = cfg[path[i]];

		if (!cfg) {
			return null;
		}
	}

	return cfg;
};


// command center registration

exports.addCommandCenter = function (packageName, requirements, commandList) {
	var commandCenter = exports.core.commandCenters[packageName] = new CommandCenter(packageName);

	commandCenter.expose(requirements, commandList);
};


// start() starts all services that allow users to connect

exports.start = function () {
	msgServer.start(clusterServer);
};


// setup() sets up mithril and its modules.
// After this (callback), mithril is ready to be started.
// Once started, users may connect.

exports.setup = function (pathConfig, cb) {
	// read the config file(s)

	var data;

	try {
		data = fs.readFileSync(pathConfig, 'utf8');
	} catch (e1) {
		fatalError('Could not find configuration file:', pathConfig, '(resolved to: ' + path.resolve(pathConfig) + ')');
	}

	try {
		config = JSON.parse(data);
	} catch (e2) {
		fatalError('Syntax error in configuration file. Run "nodelint ' + path.resolve(pathConfig) + '" to check for errors.');
	}


	// set up debugging

	var cfgDebug = config.debug;

	if (cfgDebug) {
		if (cfgDebug.colors) {
			logger.useColors();
		}

		if (cfgDebug.log) {
			// set up log contexts

			for (var name in cfgDebug.log) {
				var output = cfgDebug.log[name];

				if (output === 'file') {
					output = fs.createWriteStream(cfgDebug.logPath + '/' + name + '.log', { flags: 'a', encoding: 'utf8', mode: parseInt('0666', 8) });
				}

				logger.setContext(name, output);
			}
		}
	}


	// set up the msgServer (will expose servers)

	msgServer.setup();


	// set up cluster, if required

	var cfg = exports.getConfig('server.cluster');

	if (cfg) {
		// start a cluster, and listen for connections

		var cluster = require('cluster');

		var cl = cluster(msgServer.getClientHost().server);

		if (typeof cfg === 'number') {
			cl.set('workers', cfg);
		}

		exports.isMaster = cl.isMaster;
		exports.isWorker = cl.isWorker;

		clusterServer = cl;
	}


	// if we're a master process, our work here is done

	if (exports.isMaster) {
		// we do not call the callback that runs the game logic
		// instead we auto-launch the parts of mithril we need (msgServer)

		exports.start();

		return;
	}


	// expose modules

	modules.forEach(function (info) {
		var name = info[0];
		var path = info[1];

		logger.info('Exposing module ' + name);

		var mod = require(path);

		exports[name] = exports.core.modules[name] = mod;

		// create the event handling mechanism

		mod.eventHandlers = {};

		mod.on = function (eventName, fn) {
			var handler = { fn: fn, once: false };

			if (!mod.eventHandlers[eventName]) {
				mod.eventHandlers[eventName] = [handler];
			} else {
				mod.eventHandlers[eventName].push(handler);
			}
		};

		mod.emit = function (eventName, params, cb) {
			// real params: [givenParam1, givenParam2, ..., callback]

			var handlers = mod.eventHandlers[eventName];

			if (!handlers) {
				return cb();
			}

			async.forEachSeries(
				handlers,
				function (handler, callback) {
					handler.fn.apply(null, params.concat(callback));
				},
				cb
			);
		};
	});


	// setup modules

	function setupModule(state, name, cb) {
		var mod = exports.core.modules[name];

		if (mod.setup) {
			logger.info('Setting up module ' + name);

			mod.setup(state, cb);
		} else {
			cb();
		}
	}

	var state = new exports.core.State();

	async.forEachSeries(
		modules,
		function (mod, callback) {
			setupModule(state, mod[0], callback);
		},
		function (error) {
			state.close();

			if (error) {
				logger.error('Mithril setup failed.');
				process.exit(1);
			} else {
				logger.info('Mithril setup complete.');
			}

			cb();
		}
	);
};


exports.core.benchmark = function (n, fn) {
	var startTime = Date.now();

	for (var i = 0; i < n; i++) {
		fn();
	}

	var endTime = Date.now();
	var msec = endTime - startTime;

	logger.info('>>> Benchmark took ' + msec + ' msec for ' + n + ' iterations.');
	process.exit();
};


// Clock. Updated every second.

exports.core.time = null;

function updateTime() {
	var currentTime = Date.now();

	exports.core.time = (currentTime / 1000) << 0;	// round down

	setTimeout(updateTime, 1000 - (currentTime % 1000));

	// console.log('Scheduled time update in ' + (1000 - (currentTime % 1000)) + 'msec (current time: ' + exports.core.time + ')');
}

updateTime();

