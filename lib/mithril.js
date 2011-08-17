var path = require('path'),
    async = require('async'),
    fs = require('fs'),
    http = require('http');


exports.core = {
	State:             require('./state').State,
	PropertyMap:       require('./propertyMap').PropertyMap,
	userCommandCenter: require('./userCommandCenter'),
	modules:           {}
};


var shutdown = false;
var config;


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


// setup() sets up mithril and its modules.
// After this (callback), mithril is ready to be started.
// Once started, users may connect.

exports.setup = function (pathConfig, cb) {
	try {
		config = JSON.parse(fs.readFileSync(pathConfig, 'utf8'));
	} catch (e) {
		console.error('Could not find configuration, expected at: ' + pathConfig);
		process.exit(1);
	}

	exports.core.logger = require('./logger');
	exports.core.logger.setup(config.debug);


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


var routes = [];

exports.addRoute = function (pathMatch, fn) {
	// pathMatch is a regexp or string to match on

	// registered functions NEED to call response.end!

	if (typeof pathMatch === 'string' && pathMatch.substr(-1) === '/') {
		pathMatch = pathMatch.slice(0, -1);	// drop last slash
	}

	routes.push({ pathMatch: pathMatch, handler: fn });
};


exports.start = function () {
	var expose = exports.getConfig('server.expose');
	var bind = exports.getConfig('server.bind');


	exports.core.logger.debug('Starting HTTP service at http://' + expose.host + ':' + expose.port + '/');


	exports.core.httpServer = http.createServer(function (request, response) {
		// if we're shutting down, don't accept the request

		if (shutdown) {
			response.writeHead(404);
			response.end('Server going down for maintenance.');
			return;
		}

		exports.core.logger.debug('Received HTTP request: ' + request.url);


		// parse URL

		var url = request.url.split('?', 2);	// TODO: split may not be the best thing here
		var path = url[0];
		var params = url[1];

		if (path.substr(-1) === '/') {
			path = path.slice(0, -1);	// drop last slash
		}


		// if no route found for this path, return 404

		var handler = null;
		var i, len;

		for (i = 0, len = routes.length; i < len; i++) {
			var route = routes[i];

			if (path.match(route.pathMatch)) {
				handler = route.handler;
				break;
			}
		}

		if (!handler) {
			exports.core.logger.debug('No handler found for path: ' + path);

			response.writeHead(404);
			response.end('404 Not found');
			return;
		}


		// parse parameters

		var result = {};

		if (params) {
			params = params.split('&');

			for (i = 0, len = params.length; i < len; i++) {
				var p = params[i].split('=', 2);

				if (p.length === 2) {
					result[decodeURIComponent(p[0].replace(/\+/g, ' '))] = decodeURIComponent(p[1].replace(/\+/g, ' '));
				}
			}
		}


		// call the function in route handler

		handler(request, path, result, function (httpCode, out, headers) {
			if (httpCode === false) {
				httpCode = 404;

				if (!out) {
					out = '404 Not found';
				}
			}

			response.writeHead(httpCode, headers);
			response.end(out);
		});
	});


	exports.core.httpServer.listen(bind.port, bind.host);

	exports.core.logger.info('Server running at http://' + expose.host + ':' + expose.port + '/');

	exports.core.msgServer = require('./msgServer');
	exports.core.msgServer.start(exports.core.httpServer);
};


exports.quit = function () {
	exports.core.logger.info('Shutting down Mithril...');

	shutdown = true;

	exports.core.httpServer.close();

	setTimeout(function () {
		exports.core.logger.info('Shutdown.');
		process.exit(0);
	}, 3000);
};


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

