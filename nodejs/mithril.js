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

exports.actor  = require(paths.gameModules + '/actor/actor.js');
exports.player = require(paths.gameModules + '/player/player.js');
exports.sns    = require(paths.gameModules + '/sns/sns.js');
exports.obj    = require(paths.gameModules + '/obj/obj.js');
exports.gc     = require(paths.gameModules + '/gc/gc.js');

exports.setup = function(pathConfig)
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
			logger.error(error);
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

	exports.core.logger.info('Mithril setup complete.');
};


exports.start = function()
{
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


exports.core.time = null;
exports.core.mtime = null;

function updateTime()
{
	var currentTime = (new Date).getTime();

	exports.core.time = (currentTime / 1000) << 0;	// round down
	exports.core.mtime = currentTime;

	setTimeout(updateTime, 1000 - (currentTime % 1000));

	// console.log('Scheduled time update in ' + (1000 - (currentTime % 1000)) + 'msec (current time: ' + exports.time + ', ' + exports.mtime + ')');
}

updateTime();

