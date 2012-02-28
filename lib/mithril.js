var path = require('path'),
    async = require('async'),
    fs = require('fs'),
    EventEmitter = require('events').EventEmitter,
    logger = require('./logger');

var clusterServer = null;


// setting up the logger base settings

var allLogChannels = {
	error: process.stderr,
	info: process.stdout,
	debug: process.stdout,
	time: process.stdout
};

for (var channelName in allLogChannels) {
	logger.set(channelName, allLogChannels[channelName]);
}


process.on('uncaughtException', function (error) {
	logger.error(error.stack);
});


// detect if the cwd is correct, and if not, move into the path of the mainModule.

var rootPath = path.dirname(process.mainModule.filename);

if (process.cwd() !== rootPath) {
	process.chdir(rootPath);
}


// turn Mithril into an EventEmitter

var mithril = module.exports = new EventEmitter();


// shutdown logic

var shutdown = false;

var quit = mithril.quit = function (graceful, returnCode) {
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

			mithril.emit('shutdown');
		}
	} else {
		if (!shutdown) {
			mithril.emit('shutdown');
		}

		killProcess();
	}
};


function fatalError() {
	logger.error.apply(logger, arguments);
	quit(false, -1);
}

mithril.fatalError = fatalError;


// signal handling

process.on('SIGINT', function () {
	logger.info('Caught SIGINT.');
	quit(false);
});

process.on('SIGTERM', function () {
	logger.info('Caught SIGTERM.');
	quit(true);
});


// global default settings override

require('http').Agent.defaultMaxSockets = 100;	// max 100 parallel client sockets per agent


// create the core library holder

mithril.core = {
	modules: {},
	commandCenters: {},
	logger: logger
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
	cb(null, config.get(key, ''));
});


mithril.isMaster = false;
mithril.isWorker = false;

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


// command center registration

mithril.addCommandCenter = function (appName, requirements, commandList) {
	var commandCenter = new mithril.core.cmd.CommandCenter(appName);

	if (requirements && commandList) {
		commandCenter.expose(requirements, commandList);
	}

	mithril.core.commandCenters[appName] = commandCenter;

	return commandCenter;
};


// start() starts all services that allow users to connect

mithril.start = function () {
	msgServer.start(clusterServer);
};


function setupLogger() {
	// set up logger prefix

	logger.setPrefixer(function (line) {
		return '[' + process.pid + '] ' + (new Date()).toJSON() + ' ';
	});

	// set up base themes

	logger.addTheme('default', {
		debug: 'grey',
		info: 'green',
		time: 'magenta',
		error: 'red'
	});

	// set up default channels

	function outputTypeToStream(channel, cfg) {
		var output = cfg.output || 'terminal';

		if (output === 'terminal') {
			return channel === 'error' ? process.stderr : process.stdout;
		}

		if (output === 'file') {
			return require('fs').createWriteStream(cfg.path + '/' + channel + '.log', { flags: 'a', encoding: 'utf8', mode: parseInt(cfg.mode || '0666', 8) });
		}

		fatalError('Invalid logging output type:', cfg.output);
	}

	// set up the channels, based on config

	var oldCfg = config.get('debug');
	var cfg, channelName;

	if (oldCfg) {
		// deprecated config style

		cfg = {
			theme: oldCfg.colors ? 'default' : null,
			output: 'terminal',
			show: []
		};

		for (channelName in oldCfg.log) {
			var target = oldCfg.log[channelName];

			if (target === 'file' && oldCfg.logPath) {
				cfg.output = 'file';
				cfg.path = oldCfg.logPath;
			}

			if (target !== 'void') {
				cfg.show.push(channelName);
			}
		}
	} else {
		cfg = config.get('logging');

		if (!cfg) {
			cfg = {};
		}
	}

	// colorization

	if (cfg.theme) {
		logger.setTheme(cfg.theme);
	}

	// set up the output streams

	for (channelName in allLogChannels) {
		var hide = (cfg.hide && cfg.hide.indexOf(channelName) !== -1) || (cfg.show && cfg.show.indexOf(channelName) === -1);

		logger.set(channelName, hide ? 'void' : outputTypeToStream(channelName, cfg));
	}

	// deprecation message for old config style

	if (oldCfg) {
		logger.info('Configuring the logger through "debug" is deprecated.');
		logger.info('The new syntax is: { "logging": { "theme": "default", "show": ["debug", "info", "error", "time"], "hide": ["debug"], "output": "terminal"/"file", "path": "/var/log/myGame" } }');
		logger.info('When "theme" is left out, no colors will be applied.');
		logger.info('Both "show" and "hide" are optional, but by default all channels are output.');
		logger.info('Default "output" is "terminal", so it may be left out. If "output" is "file", a "path" leading to a writable directory is required. Files will be called "channelName.log", eg: "error.log".');
	}
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


	// set up the msgServer (will expose servers)

	msgServer.setup();


	// set up cluster, if required

	var cfg = config.get('server.cluster');

	if (cfg) {
		// start a cluster, and listen for connections

		var cluster = require('cluster');

		var cl = cluster(msgServer.getClientHost().server);

		if (typeof cfg === 'number') {
			cl.set('workers', cfg);
		}

		mithril.isMaster = cl.isMaster;
		mithril.isWorker = cl.isWorker;

		clusterServer = cl;
	}


	// if we're a master process, our work here is done

	if (mithril.isMaster) {
		// we do not call the callback that runs the game logic
		// instead we auto-launch the parts of mithril we need (msgServer)

		mithril.start();

		return;
	}


	// expose modules

	modules.forEach(function (info) {
		var name = info[0];
		var path = info[1];

		logger.info('Exposing module ' + name);

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
			logger.info('Setting up module ' + name);

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
				logger.error('Mithril setup failed.');
				process.exit(1);
			} else {
				logger.info('Mithril setup complete.');
			}

			cb();
		}
	);
};


mithril.core.benchmark = function (n, fn) {
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

mithril.core.time = null;

function updateTime() {
	var currentTime = Date.now();

	mithril.core.time = (currentTime / 1000) << 0;	// round down

	setTimeout(updateTime, 1000 - (currentTime % 1000));

	// console.log('Scheduled time update in ' + (1000 - (currentTime % 1000)) + 'msec (current time: ' + mithril.core.time + ')');
}

updateTime();

