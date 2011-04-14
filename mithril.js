global.mithril = this;

var path = require('path');

var gamePath = path.dirname(process.mainModule.filename);
var rootPath = path.dirname(module.filename);

var paths = {
	root:   rootPath,
	extlib: rootPath + '/extlib',
	lib:    rootPath + '/lib'
};

exports.state = require(paths.lib + '/state.js');
exports.paths = paths;


exports.setup = function(pathConfig)
{
	var fs = require('fs');

	var config = JSON.parse(fs.readFileSync(pathConfig, 'utf8'));

	exports.config = config;
	exports.datasources = require(paths.lib + '/datasources.js');

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

		exports.logger = logger;
	}

	exports.warn = function(error, client)
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
};


exports.start = function()
{
	var httpServer = require('http').createServer(function(request, response) {
		if (true || req.url == '/favicon.ico')
		{
			res.writeHead(404);
			res.end('404 Not found');
			return;
		}
	});

	exports.httpServer.listen(mithril.config.server.port, mithril.config.server.host);

	exports.msgServer = require(paths.lib + '/msg-server.js');
	exports.msgServer.start(exports.httpServer);
};

