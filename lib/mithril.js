var path = require('path'),
    util = require('util'),
    async = require('async'),
    EventEmitter = require('events').EventEmitter;

// turn Mithril into an EventEmitter

function Mithril() {
	EventEmitter.call(this);
}


util.inherits(Mithril, EventEmitter);

var mithril = module.exports = new Mithril();


var loggingService = require('./loggingService');

loggingService.addWriter('terminal', ['>=notice'], {});


var logger = loggingService.getCreator();

// detect if the cwd is correct, and if not, move into the path of the mainModule.
// If mithril is imported into an interactive console, process.mainModule is undefined so
// use the current directory instead

var rootPath = path.dirname(process.mainModule && process.mainModule.filename || process.cwd());

if (process.cwd() !== rootPath) {
	process.chdir(rootPath);
}

var mithrilPackage = require(path.join(path.dirname(__dirname), 'package.json'));

mithril.version = mithrilPackage.version;


// shutdown logic

mithril.isShuttingDown = false;

var quit = mithril.quit = function (graceful, returnCode) {
	if (mithril.isShuttingDown) {
		return;
	}

	mithril.isShuttingDown = true;

	logger.verbose('Shutting down Mithril...');
	mithril.emit('shutdown');

	var datasources = require('./datasources');

	datasources.close(function () {
		// console.log(process._getActiveHandles());
		// console.log(process._getActiveRequests());

		// This condition is required for the case
		// where we do not have a process manager
		// yet (e.g. mithril logger is broken)
		if (mithril.core.processManager) {
			mithril.core.processManager.quit(graceful, returnCode);
		} else {
			process.exit(returnCode);
		}
	});
};


function fatalError() {
	logger.emergency.apply(logger, arguments);
	quit(false, -1);
}

mithril.fatalError = fatalError;


// global default settings override

require('http').Agent.defaultMaxSockets = 100;	// max 100 parallel client sockets per agent


// create the core library holder

mithril.core = {
	modules: {},
	commandCenters: {},
	logger: logger,
	loggingService: loggingService
};


// load the required mithril libraries

var config = new (require('./config')).Config();

mithril.core.State            = require('./state').State;
mithril.core.PropertyMap      = require('./propertyMap').PropertyMap;
mithril.core.LivePropertyMap  = require('./livePropertyMap').LivePropertyMap;

mithril.core.config           = config;
mithril.core.helpers          = require('./helpers');
mithril.core.app              = require('./app');
mithril.core.datatypes        = require('./datatypes');
mithril.core.serviceDiscovery = new (require('./serviceDiscovery')).ServiceDiscovery();
mithril.core.clients          = require('./clients');
mithril.core.msgServer        = require('./msgServer');
mithril.core.cmd              = require('./commandCenter');


mithril.core.app.builders.add('cfg', function (buildTarget, language, context, key, cb) {
	cb(null, JSON.stringify(config.get(key, '')));
});


var msgServer = mithril.core.msgServer;


// requiring Mithril modules

var modules = [];


mithril.useModule = function (name) {
	modules.push([name, './modules/' + name]);
};


mithril.addModule = function (name, modPath) {
	// adding custom game-specific modules

	// resolve the path to a full path relative to rootPath

	modPath = path.resolve(rootPath, modPath);

	// register the module

	modules.push([name, modPath]);
};


mithril.getModulePath = function (name) {
	for (var i = 0, len = modules.length; i < len; i++) {
		var mod = modules[i];

		if (mod[0] === name) {
			return path.dirname(require.resolve(mod[1]));
		}
	}

	return null;
};


mithril.listModules = function () {
	// returns all registerd module names, in registered order

	return modules.map(function (mod) {
		return mod[0];
	});
};


// command center registration (DEPRECATED)

mithril.addCommandCenter = function () {
	fatalError('mithril.addCommandCenter() is no longer supported. Apps now come with a command center out of the box, so you should call yourApp.commandCenter.expose()');
};


function setupLogger() {

	// Fix your configuration message for old config style

	if (config.get('debug') || config.get('logging.show') || config.get('logging.hide')) {
		var example = {
            logging: {
				html5: {
					console: {
						channels: [">=debug"]
					},
					server: {
						channels: [">=critical"]
					}
				},
				server: {
					terminal: {
						channels: [">=info"],
						config: {
							jsonIndent: 2,
							theme: "default",
							comments:  "jsonIndent sets the indentation of the json object logged in data() log calls (see documentation)",
							comments2: "two new themes available: dark and light"
						}
					},
					file: {
						channels: ["<info", ">=critical", "error"],
						config: {
							jsonIndent: 2,
							path: "./logs/",
							mode: "0600",
							comments:  "jsonIndent sets the indentation of the json object logged in data() log calls (see documentation)"
						}
					},
					graylog: {
						channels: [">=info"],
						config: {
							servers: [
								{ host: "192.168.100.85", port: 12201 },
								{ host: "192.168.100.86", port: 12201 }
							],
							facility: "Application identifier"
						}
					},
					websocket: {
						"does not take a channel argument": false,
						config: {
							port: 31337,
							comment: "this can listen only on net ports, not on socket files - the port accepts websocket conections"
						}
					},
					loggly: {
						channels: [">=info"],
						config: {
							token: "token, see loggly indication on web interface account login",
							subdomain: "subdomain"
						}
					}
				}
			}
        };

		logger.emergency
			.details('An example of an accurate configuration is available in the following JSON structure.')
			.details('Please take note that some of those variables are optional.')
			.data(example)
			.log('Configuring the logger through "debug" or "logging > show" is now invalid.');

		mithril.fatalError('Configuration is not up to date, exiting...');
	}

	loggingService.configure(config.get('logging.server'));
}


// setup() sets up mithril and its modules.
// After this (callback), mithril is ready to be started.
// Once started, users may connect.

mithril.setup = function (pathConfig, cb) {
	// read the config file(s)

	try {
		config.add(pathConfig);
	} catch (e) {
		fatalError(e);
	}


	// set up the logging system according to config

	setupLogger();


	// start the process manager

	var pm = mithril.core.processManager = require('./processManager');
	mithril.core.processManager.start();

	// set up the msgServer. This will:
	// - set up a clientHost (HTTP server) for workers and standalone
	// - connect to peers in the network for master and standalone

	msgServer.setup();

	if (pm.isMaster) {
		// master has nothing left to do!
		return;
	}

	// expose modules

	modules.forEach(function (info) {
		var name = info[0];
		var path = info[1];

		logger.verbose('Exposing module ' + name);

		var mod = require(path);

		mithril[name] = mithril.core.modules[name] = mod;

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
		var mod = mithril.core.modules[name];

		if (mod.setup) {
			logger.verbose('Setting up module ' + name);

			mod.setup(state, cb);
		} else {
			cb();
		}
	}

	var state = new mithril.core.State();

	async.forEachSeries(
		modules,
		function (mod, callback) {
			setupModule(state, mod[0], callback);
		},
		function (error) {
			state.close();

			if (error) {
				logger.emergency('Mithril setup failed.');
				process.exit(1);
				return;
			} else {
				logger.notice('Mithril setup complete.');
			}

			cb();
		}
	);
};


// start() starts all services that allow users to connect

mithril.start = function () {
	msgServer.startClientHost();
};


mithril.core.benchmark = function (n, fn) {
	var startTime = Date.now();

	for (var i = 0; i < n; i++) {
		fn();
	}

	var endTime = Date.now();
	var msec = endTime - startTime;

	logger.info('>>> Benchmark took', msec, 'msec for', n, 'iterations.');
	process.exit();
};


// Clock. Updated every second.

mithril.core.time = null;

function updateTime() {
	var currentTime = Date.now();

	mithril.core.time = (currentTime / 1000) << 0;	// round down

	setTimeout(updateTime, 1000 - (currentTime % 1000));
}

updateTime();

