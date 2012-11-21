var mithril = require('../mithril'),
	comm = require('./comm'),
	logger = mithril.core.logger.context('msgServer');

exports.comm = comm;


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
		logger.emergency('No clientHost configured');
		process.exit(-1);
		return;
	}

	return cfg;
}


exports.setup = function () {
	var pm = mithril.core.processManager;

	// only non-masters have a clientHost

	if (!pm.isMaster) {
		// set up the clientHost

		logger.verbose('Setting up msgServer clientHost');

		var cfg = getClientHostConfig();

		if (!cfg.bind) {
			return mithril.fatalError('No binding configured for clientHost.');
		}

		if (cfg.protocol === 'http') {
			// also expose the clienthost as an http server

			clientHost = httpServer = require('./transports/http');
		} else {
			return mithril.fatalError('Unrecognized clientHost protocol:', cfg.protocol);
		}
	}

	logger.verbose('Setting up msgServer comm');

	comm.setup();
};


exports.startClientHost = function () {
	logger.verbose('Starting clientHost...');

	var cfg = getClientHostConfig();
	if (!cfg) {
		return;
	}

	var binding = cfg.bind;

	if (!binding) {
		return mithril.fatalError('No binding configured for clientHost.');
	}

	try {
		if (binding.file) {
			clientHost.server.listen(binding.file, function () {
				require('fs').chmod(binding.file, parseInt('777', 8));

				logger.notice('Server running at ' + cfg.protocol + '://' + binding.file);
			});
		} else if (binding.host && binding.port) {
			clientHost.server.listen(binding.port, binding.host, function () {
				logger.notice('Server running at ' + cfg.protocol + '://' + binding.host + ':' + binding.port);
			});
		} else {
			mithril.fatalError('Required configuration missing: (server.clientHost.bind.host and server.clientHost.bind.port) or server.clientHost.bind.file');
		}
	} catch (e) {
		logger.emergency('Error while trying to listen on:', cfg);
		mithril.fatalError(e);
	}
};

