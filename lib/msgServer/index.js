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

	if (cfg.protocol === 'http') {
		// also expose the clienthost as an http server

		clientHost = httpServer = require('./transports/http');
	} else {
		mithril.fatalError('Unrecognized clientHost protocol:', cfg.protocol);
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

