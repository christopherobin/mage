var mithril = require('../mithril'),
    async   = require('async');

var comm = exports.comm = require('./comm');


// transport exposure:

var clientHost, httpServer;

exports.getClientHost = function () {
	return clientHost || null;
};

exports.getHttpServer = function () {
	return httpServer || null;
};


// startup messaging server

function getClientHostConfig() {
	var cfg = mithril.core.config.get('server.clientHost');
	if (!cfg) {
		mithril.core.logger.error('No clientHost configured');
		process.exit(-1);
	}

	return cfg;
}


exports.setup = function () {
	// set up the clientHost

	var cfg = getClientHostConfig();

	if (!cfg.bind) {
		return mithril.fatalError();
	}

	switch (cfg.protocol) {
	case 'http':
		// also expose the clienthost as an http server

		clientHost = httpServer = require('./transports/http');
		break;
	default:
		mithril.fatalError('Unrecognized clientHost protocol:', cfg.protocol);
		break;
	}
};


exports.start = function (server) {
	var cfg = getClientHostConfig();

	var binding = cfg.bind;

	if (!binding) {
		return mithril.fatalError('No binding configured for clientHost.');
	}

	if (!server) {
		server = clientHost.server;
	}

	// set up comm

	comm.setup();

	// listen

	try {
		if (binding.file) {
			server.listen(binding.file, function () {
				require('fs').chmod(binding.file, parseInt('777', 8));

				mithril.core.logger.info('Server running at ' + cfg.protocol + '://' + binding.file);
			});
		} else if (binding.host && binding.port) {
			server.listen(binding.port, binding.host, function () {
				mithril.core.logger.info('Server running at ' + cfg.protocol + '://' + binding.host + ':' + binding.port);
			});
		} else {
			mithril.fatalError('Required configuration missing: (server.clientHost.bind.host and server.clientHost.bind.port) or server.clientHost.bind.file');
		}
	} catch (e) {
		mithril.fatalError(e);
	}

	mithril.on('shutdown', function () {
		mithril.core.logger.info('Shutting down clientHost...');
		server.close();
	});
};

/*
function processCommand(state, tags, path, queryId, params, cb) {
	if (path[0] === '/') {
		path = path.substring(1);
	}

	path = path.split('/');

	var appName = path.shift();
	var cmdName = path.join('/');

	var commandCenter = mithril.core.commandCenters[appName];
	if (commandCenter) {
		// execute the command

		commandCenter.execute(state, tags, cmdName, queryId, params, cb);
	} else {
		state.error(null, 'No command center found for application "' + appName + '"', cb);
	}
}


exports.processCommandRequest = function (transportInfo, path, queryId, header, message, transportCallback) {
	// cb: function (content, options)

	var state = new State(null, null);

	state.onclose = transportCallback;

	processCommandHeader(state, header, message, function (error, tags, params) {
		if (error) {
			// direct error response, due to header parse error

			state.close();
		} else {
			// tag the request with the transport type

			tags.transport = transportInfo.type || null;

			// execute command

			processCommand(state, tags, path, queryId, params, function () {
				state.close(queryId);
			});
		}
	});
};
*/
