global.mithril = this;

exports.core = {};

var path = require('path');

var gamePath = path.dirname(process.mainModule.filename);
var rootPath = path.dirname(module.filename);

var paths = {
	root:        rootPath,
	extlib:      rootPath + '/extlib',
	lib:         rootPath + '/lib',
	gameModules: rootPath + '/game-modules'
};

exports.core.paths = paths;
exports.core.state = require(paths.lib + '/state.js');
exports.core.userCommandCenter = require(paths.lib + '/userCommandCenter.js');
exports.core.testing = require(paths.lib + '/testing.js');

// import game modules

var modules = {
	actor:  paths.gameModules + '/actor/actor.js',
	player: paths.gameModules + '/player/player.js',
	sns:    paths.gameModules + '/sns/sns.js',
	obj:    paths.gameModules + '/obj/obj.js',
	gc:     paths.gameModules + '/gc/gc.js'
};


exports.addModule = function(name, path)
{
	modules[name] = path;
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


	// expose modules and set them up

	function onDone()
	{
		exports.core.logger.info('Mithril setup complete.');
		cb();
	}


	// expose modules

	var moduleCount = 0;
	var done = 0;

	for (var key in modules)
	{
		exports.core.logger.info('Exposing module ' + key);

		exports[key] = require(modules[key]);
		moduleCount++;
	}

	for (var key in modules)
	{
		if (exports[key].setup)
		{
			exports.core.logger.info('Setting up module ' + key);

			exports[key].setup(function() { if (++done == moduleCount) onDone(); });
		}
		else
		{
			if (++done == moduleCount) onDone();
		}
	}
};


// start() starts all services that allow users to connect

exports.start = function()
{
	exports.core.logger.debug('Starting HTTP service at http://' + exports.core.config.server.host + ':' + exports.core.config.server.port + '/');

	exports.core.httpServer = require('http').createServer(function(request, response) {
		if (true || request.url == '/favicon.ico')
		{
			res.writeHead(404);
			res.end('404 Not found');
			return;
		}
	});

	exports.core.httpServer.listen(exports.core.config.server.port, exports.core.config.server.host);

	exports.core.logger.info('Server running at http://' + exports.core.config.server.host + ':' + exports.core.config.server.port + '/');

	exports.core.msgServer = require(paths.lib + '/msgServer.js');
	exports.core.msgServer.start(exports.core.httpServer);
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

