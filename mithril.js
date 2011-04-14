global.mithril = this;

var path = require('path');
var fs   = require('fs');

var gamePath = path.dirname(process.mainModule.filename);
var rootPath = path.dirname(module.filename);

var paths = {
	root:   rootPath,
	extlib: rootPath + '/extlib',
	lib:    rootPath + '/lib'
};


function State(session, msgClient, datasources)
{
	this.session = session || null;			// if requests concern a player session
	this.msgClient = msgClient || null;		// if live feedback is required through the message server
	this.datasources = datasources || null;	// if datasources are required
};

State.prototype.cleanup = function()
{
	if (this.datasources)
	{
		this.datasources.close();
		this.datasources = null;
	}
};


exports.State = State;
exports.paths = paths;


exports.setup = function(pathConfig)
{
	var config = JSON.parse(fs.readFileSync(pathConfig, 'utf8')); //   paths.root + '/config/config.json', 'utf8'));

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

		exports.log = logger;
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

	process.on('uncaughtException', function(error) {
		logger.error(error);
	});
};

