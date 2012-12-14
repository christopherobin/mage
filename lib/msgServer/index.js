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


exports.setup = function (cb) {
	var cfg, error;

	// Only non-masters have a clientHost

	if (!mithril.core.processManager.isMaster) {
		// Set up the clientHost

		logger.verbose('Setting up msgServer clientHost');

		cfg = mithril.core.config.get('server.clientHost');

		if (!cfg) {
			error = new Error('No clientHost configured');
			logger.emergency(error);
			return cb(error);
		}

		if (!cfg.bind) {
			error = new Error('No binding configured for clientHost.');
			logger.emergency(error);
			return cb(error);
		}

		if (cfg.protocol === 'http') {
			// Also explicitly expose the clientHost as an HTTP server

			clientHost = httpServer = require('./transports/http');
		} else {
			error = new Error('Unrecognized clientHost protocol: ' + cfg.protocol);
			logger.emergency(error);
			return cb(error);
		}
	}

	// Set up comm library

	comm.setup(cb);
};


exports.startClientHost = function (cb) {
	var error, cfg;

	logger.verbose('Starting clientHost...');

	cfg = getClientHostConfig();
	if (!cfg) {
		error = new Error('No clientHost configured.');
		logger.emergency(error);
		return cb(error);
	}

	var binding = cfg.bind;

	if (!binding) {
		error = new Error('No binding configured for clientHost.');
		logger.emergency(error);
		return cb(error);
	}

	// unix file socket binding

	if (binding.hasOwnProperty('file')) {
		logger.debug('ClientHost about to listen on', binding.file);

		clientHost.listen(binding.file, function (error) {
			if (error) {
				logger.emergency(error);
				return cb(error);
			}

			require('fs').chmod(binding.file, parseInt('777', 8));

			logger.notice('Server running at ' + cfg.protocol + '://' + binding.file);

			cb();
		});
		return;
	}

	// tcp binding

	if (binding.hasOwnProperty('port')) {
		logger.debug('ClientHost about to listen on port', binding.port);

		// binding.host is optional and may be undefined (translates to INADDR_ANY)

		clientHost.listen(binding.port, binding.host, function (error, address) {
			if (error) {
				logger.emergency(error);
				return cb(error);
			}

			logger.notice('Server running at ' + cfg.protocol + '://' + address.address + ':' + address.port);

			cb();
		});
		return;
	}

	// no suitable binding configured

	error = new Error('Required configuration missing: (server.clientHost.bind.host and server.clientHost.bind.port) or server.clientHost.bind.file');
	logger.emergency.data('cfg', cfg).log(error);
	cb(error);
};
