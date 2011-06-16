global.mithril = this;

exports.core = {};

var path = require('path');

var gamePath = path.dirname(process.mainModule.filename);
var rootPath = path.dirname(module.filename);

var paths = {
	root:        rootPath,
	lib:         rootPath + '/lib',
	gameModules: rootPath + '/game-modules'
};

var shutdown = false;

global.async = require('async');

exports.core.paths = paths;
exports.core.state = require(paths.lib + '/state.js');
exports.core.userCommandCenter = require(paths.lib + '/userCommandCenter.js');
exports.core.PropertyMap = require(paths.lib + '/propertyMap.js');
exports.core.lib = {};
exports.core.modules = {};


// available libraries and modules

var coreLibraries = {
};

var coreModules = {
	manage:     paths.gameModules + '/manage/manage.js',
	shop:       paths.gameModules + '/shop/shop.js',
	gree:       paths.gameModules + '/gree/gree.js',
	actor:      paths.gameModules + '/actor/actor.js',
	player:     paths.gameModules + '/player/player.js',
	persistent: paths.gameModules + '/persistent/persistent.js',
	npc:        paths.gameModules + '/npc/npc.js',
	sns:        paths.gameModules + '/sns/sns.js',
	obj:        paths.gameModules + '/obj/obj.js',
	gc:         paths.gameModules + '/gc/gc.js',
	msg:        paths.gameModules + '/msg/msg.js',
	score:      paths.gameModules + '/score/score.js'
};


// requiring libraries and modules

var modules = [];

exports.useLibrary = function(name)
{
	// loading specific libraries

	if (!coreLibraries[name])
	{
		console.error('Library ' + name + ' not found.');
		process.exit(1);
	}

	exports.core.lib[name] = require(coreLibraries[name]);
};

exports.useModule = function(name)
{
	// using mithril modules

	if (!coreModules[name])
	{
		console.error('Module ' + name + ' not found.');
		process.exit(1);
	}

	modules.push([name, coreModules[name]]);
};

exports.addModule = function(name, path)
{
	// adding custom game-specific modules

	modules.push([name, path]);
};


// setup() sets up mithril and its modules.
// After this (callback), mithril is ready to be started.
// Once started, users may connect.

exports.setup = function(pathConfig, cb)
{
	var fs = require('fs');

	var config = JSON.parse(fs.readFileSync(pathConfig, 'utf8'));

	exports.core.config = config;
	exports.core.datasources = require(paths.lib + '/datasources.js');

	var logger = {};

	if (config.debug && config.debug.log)
	{
		paths.log = path.resolve(gamePath, config.debug.logPath);

		var logger = require(paths.lib + '/logger.js');

		for (var name in config.debug.log)
		{
			var output = config.debug.log[name];

			if (output == 'file')
				logger.add(name, fs.createWriteStream(paths.log + '/' + name + '.log', { flags: 'a', encoding: 'utf8', mode: 0666 }));
			else
				logger.add(name, output);
		}

		process.on('uncaughtException', function(error) {
			logger.error(error.stack);
		});
	}

	if (!logger.info)  logger.info  = function() {};
	if (!logger.error) logger.error = function() {};
	if (!logger.debug) logger.debug = function() {};

	exports.core.logger = logger;


	// expose modules

	modules.forEach(function(info) {
		var name = info[0];
		var path = info[1];

		exports.core.logger.info('Exposing module ' + name);

		exports[name] = exports.core.modules[name] = require(path);
	});


	// setup modules

	function setupModule(state, name, cb)
	{
		var mod = exports.core.modules[name];

		if (mod.setup)
		{
			exports.core.logger.info('Setting up module ' + name);

			mod.setup(state, cb);
		}
		else
			cb();
	}

	var state = new exports.core.state.State;

	async.forEachSeries(
		modules,
		function(mod, callback) {
			setupModule(state, mod[0], callback);
		},
		function(error) {
			state.close();

			if (error)
			{
				exports.core.logger.error('Mithril setup failed.');
				process.exit(1);
			}
			else
				exports.core.logger.info('Mithril setup complete.');

			cb();
		}
	);
};


// start() starts all services that allow users to connect


var routes = [];

exports.addRoute = function(pathMatch, fn)
{
	// pathMatch is a regexp or string to match on

	// registered functions NEED to call response.end!

	if (typeof pathMatch === 'string' && pathMatch.substr(-1) === '/') pathMatch = pathMatch.slice(0, -1);	// drop last slash

	routes.push({ pathMatch: pathMatch, handler: fn });
};


exports.start = function()
{
	exports.core.logger.debug('Starting HTTP service at http://' + exports.core.config.server.expose.host + ':' + exports.core.config.server.expose.port + '/');


	exports.core.httpServer = require('http').createServer(function(request, response) {
		// if we're shutting down, don't accept the request

		if (shutdown)
		{
			response.writeHead(404);
			response.end('Server going down for maintenance.');
			return;
		}


		// parse URL

		var url = request.url.split('?', 2);
		var path = url[0];
		var params = url[1];

		if (path.substr(-1) === '/') path = path.slice(0, -1);	// drop last slash


		// if no route found for this path, return 404

		var handler = null;
		var routeCount = routes.length;
		for (var i=0; i < routeCount; i++)
		{
			var route = routes[i];

			if (path.match(route.pathMatch))
			{
				handler = route.handler;
				break;
			}
		}

		if (!handler)
		{
			mithril.core.logger.debug('No handler found for path: ' + path);

			response.writeHead(404);
			response.end('404 Not found');
			return;
		}


		// parse parameters

		var result = {};

		if (params)
		{
			params = params.split('&');
			for (var i=0; i < params.length; i++)
			{
				var p = params[i].split('=', 2);
				if (p.length == 2)
				{
					result[decodeURIComponent(p[0]).replace(/\+/g, ' ')] = decodeURIComponent(p[1]).replace(/\+/g, ' ');
				}
			}
		}


		// call the function in route handler

		handler(request, path, result, function(httpCode, out, headers) {
			if (httpCode === false)
			{
				httpCode = 404;
				if (!out) out = '404 Not found';
			}

			response.writeHead(httpCode, headers);
			response.end(out);
		});
	});


	exports.core.httpServer.listen(exports.core.config.server.bind.port, exports.core.config.server.bind.host);

	exports.core.logger.info('Server running at http://' + exports.core.config.server.expose.host + ':' + exports.core.config.server.expose.port + '/');

	exports.core.msgServer = require(paths.lib + '/msgServer.js');
	exports.core.msgServer.start(exports.core.httpServer);
};


exports.quit = function()
{
	exports.core.logger.info('Shutting down Mithril...');

	shutdown = true;

	exports.core.httpServer.close();

	setTimeout(function() {
		exports.core.logger.info('Shutdown.');
		process.exit(0);
	}, 3000);
};



// Clock. Updated every second.

exports.core.time = null;

function updateTime()
{
	var currentTime = (new Date).getTime();

	exports.core.time = (currentTime / 1000) << 0;	// round down

	setTimeout(updateTime, 1000 - (currentTime % 1000));

	// console.log('Scheduled time update in ' + (1000 - (currentTime % 1000)) + 'msec (current time: ' + exports.time + ')');
}

updateTime();

