var mage = require('../mage'),
	path = require('path'),
	comm = require('./comm'),
	logger = mage.core.logger.context('msgServer');

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

exports.setup = function (cb) {
	var cfg, error;

	// Only non-masters have a clientHost

	if (!mage.core.processManager.isMaster) {
		// Set up the clientHost

		logger.verbose('Setting up msgServer clientHost');

		cfg = mage.core.config.get('server.clientHost', {});

		if (cfg.protocol && cfg.protocol !== 'http') {
			error = new Error('Unrecognized clientHost protocol: ' + cfg.protocol);
			logger.emergency(error);
			return cb(error);
		}

		// Also explicitly expose the clientHost as an HTTP server
		cfg.protocol = 'http';
		clientHost = httpServer = require('./transports/http');
	}

	// Set up comm library

	comm.setup(cb);
};


exports.startClientHost = function (cb) {
	logger.verbose('Starting clientHost...');

	var cfg = mage.core.config.get('server.clientHost', {});
	var binding = cfg.bind;

	if (!binding || !binding.port) {
		logger.notice('No binding configured for clientHost, defaulting to ./server.sock');
		binding = { file: './server.sock' };
	}

	// tcp binding

	if (binding.hasOwnProperty('port')) {
		logger.debug('ClientHost about to listen on port', binding.port);

		// binding.host is optional and may be undefined (translates to INADDR_ANY)

		clientHost.listen(binding.port, binding.host, function (error, address) {
			if (error) {
				switch (error.code) {
				case 'EADDRINUSE':
					logger.emergency('Port is in use - ', binding.host + ':' + binding.port);
					break;
				case 'EACCES':
					logger.emergency('Access denied when trying to bind to', binding.host + ':' + binding.port);
					break;
				default:
					logger.emergency(error);
				}
				return cb(error);
			}

			logger.notice('Server running at http://' + address.address + ':' + address.port);

			cb();
		});

		return;
	}

	// unix file socket binding

	logger.debug('ClientHost about to listen on', path.resolve(binding.file));

	clientHost.listen(binding.file, function (error) {
		if (error) {
			switch (error.code) {
			case 'EADDRINUSE':
				logger.emergency(binding.file, 'already exists. Perhaps the server did not shutdown cleanly. Try removing the file and starting again.');
				break;
			case 'EACCES':
				logger.emergency(binding.file, 'cannot be created. Please check your config file.');
				break;
			default:
				logger.emergency(error);
			}
			return cb(error);
		}

		require('fs').chmod(binding.file, parseInt('777', 8));

		logger.notice('Server bound to ' + path.resolve(binding.file));

		cb();
	});
};
