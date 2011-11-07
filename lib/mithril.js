var path = require('path'),
    async = require('async'),
    fs = require('fs'),
    http = require('http'),
    CommandCenter = require('./commandCenter').CommandCenter,
	ServiceDiscovery = require('./serviceDiscovery').ServiceDiscovery;


exports.shutdown = false;

exports.core = {};
exports.core.modules = {};
exports.core.commandCenters = {};
exports.core.logger           = require('./logger');
exports.core.helpers          = require('./helpers');
exports.core.State            = require('./state').State;
exports.core.PropertyMap      = require('./propertyMap').PropertyMap;
exports.core.LivePropertyMap  = require('./livePropertyMap').LivePropertyMap;
exports.core.serviceDiscovery = new ServiceDiscovery();
exports.core.msgServer        = require('./msgServer');
exports.core.clients          = require('./clients');


var config;
var msgServer = exports.core.msgServer;


// requiring Mithril modules

var modules = [];


exports.useModule = function (name) {
	modules.push([name, './modules/' + name]);
};


exports.addModule = function (name, path) {
	// adding custom game-specific modules

	modules.push([name, path]);
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


// setup() sets up mithril and its modules.
// After this (callback), mithril is ready to be started.
// Once started, users may connect.

exports.setup = function (pathConfig, cb) {
	// read the config file

	var data;

	try {
		data = fs.readFileSync(pathConfig, 'utf8');
	} catch (e1) {
		console.error('Could not find configuration, expected at: ' + pathConfig);
		process.exit(1);
	}

	try {
		config = JSON.parse(data);
	} catch (e2) {
		console.error('Syntax error in configuration file.');
		process.exit(1);
	}

	exports.core.logger.setup(config.debug);


	// set up the msgServer (will expose servers)

	msgServer.setup();


	// expose modules

	modules.forEach(function (info) {
		var name = info[0];
		var path = info[1];

		exports.core.logger.info('Exposing module ' + name);

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
			exports.core.logger.info('Setting up module ' + name);

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
				exports.core.logger.error('Mithril setup failed.');
				process.exit(1);
			} else {
				exports.core.logger.info('Mithril setup complete.');
			}

			cb();
		}
	);
};


// start() starts all services that allow users to connect

exports.start = function () {
	// listen for connections

	msgServer.start();
};


var quit = exports.quit = function (graceful, returnCode) {
	function killProcess() {
		exports.core.logger.info('Shutdown.');
		process.exit(returnCode || 0);
	};

	if (graceful) {
		if (!exports.shutdown) {
			exports.core.logger.info('Shutting down Mithril...');

			exports.shutdown = true;

			if (msgServer) {
				msgServer.close();
			}

			setTimeout(killProcess, 3000);
		}
	} else {
		killProcess();
	}
};


exports.fatalError = function (error) {
	exports.core.logger.error(error);
	quit(false, -1);
};


// signal handling

process.on('SIGINT', function () {
	quit(false);
});

process.on('SIGTERM', function () {
	quit(true);
});


exports.core.benchmark = function (n, fn) {
	var startTime = Date.now();

	for (var i = 0; i < n; i++) {
		fn();
	}

	var endTime = Date.now();
	var msec = endTime - startTime;

	console.log('>>> Benchmark took ' + msec + ' msec for ' + n + ' iterations.');
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

