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
exports.core.propertyMap = require(paths.lib + '/propertyMap.js');


// import game modules

var modules = [
	['manage', paths.gameModules + '/manage/manage.js'],
	['actor',  paths.gameModules + '/actor/actor.js'],
	['player', paths.gameModules + '/player/player.js'],
	['npc',    paths.gameModules + '/npc/npc.js'],
	['sns',    paths.gameModules + '/sns/sns.js'],
	['obj',    paths.gameModules + '/obj/obj.js'],
	['gc',     paths.gameModules + '/gc/gc.js'],
	['msg',    paths.gameModules + '/msg/msg.js'],
	['score',  paths.gameModules + '/score/score.js']
];

var customModules = [
];


exports.addModule = function(name, path)
{
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
		paths.log = path.resolve(gamePath, config.logPath);

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


	exports.core.warn = function(error, client)
	{
		if (error.log)
		{
			logger[error.log.method](error.module + ', code ' + error.code + ': ' + error.log.msg);
		}

		if (client && client.connected)
		{
			var userError = { error: { type: error.type }};
			if (error.usermsg) userError.error.msg = error.usermsg;

			client.send(JSON.stringify(userError));
		}
	};


	// expose modules

	function loadModule(state, name, path, callback)
	{
		exports.core.logger.info('Exposing module ' + name);

		var mod = require(path);

		exports[name] = mod;

		if (mod.setup)
		{
			exports.core.logger.info('Setting up module ' + name);

			mod.setup(state, callback);
		}
		else
			callback();
	}

	var state = new exports.core.state.State;

	async.forEachSeries(
		modules,
		function(mod, callback) {
			loadModule(state, mod[0], mod[1], callback);
		},
		function(error) {
			state.close();

			if (error)
				exports.core.logger.error('Mithril setup failed.');
			else
				exports.core.logger.info('Mithril setup complete.');

			cb(error);
		}
	);
};


// start() starts all services that allow users to connect


var routes = {};

exports.route = function(path, fn)
{
	// registered functions NEED to call response.end!

	if (path.substr(-1) === '/') path = path.slice(0, -1);	// drop last slash

	routes[path] = fn;
};


exports.start = function()
{
	exports.core.logger.debug('Starting HTTP service at http://' + exports.core.config.server.host + ':' + exports.core.config.server.port + '/');


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

		if (!(path in routes))
		{
			response.writeHead(404);
			response.end('404 Not found');
			return;
		}


		// parse parameters

		var result = {};

		params = params.split('&');
		for (var i=0; i < params.length; i++)
		{
			var p = params[i].split('=', 2);
			if (p.length == 2)
			{
				result[decodeURIComponent(p[0])] = decodeURIComponent(p[1]);
			}
		}


		// call the function in routes[path]

		routes[path](request, response, result);
	});


	exports.core.httpServer.listen(exports.core.config.server.port, exports.core.config.server.host);

	exports.core.logger.info('Server running at http://' + exports.core.config.server.host + ':' + exports.core.config.server.port + '/');

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

