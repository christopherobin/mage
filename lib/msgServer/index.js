var mage = require('../mage');
var path = require('path');
var comm = require('./comm');
var logger = mage.core.logger.context('msgServer');

exports.comm = comm;

mage.core.config.setTopLevelDefault('server', path.join(__dirname, 'config.yaml'));

// transport exposure:

var clientHost;

if (!mage.core.processManager.isMaster) {
	// Only non-masters have a clientHost

	clientHost = require('./transports/http');
}

exports.getClientHost = function () {
	return clientHost || null;
};

exports.getHttpServer = function () {
	return clientHost || null;
};

exports.getMsgStreamUrl = function (headers) {
	return require('./msgStream').getBaseUrl(headers);
};


// startup messaging server

exports.setup = function (cb) {
	// Set up comm library

	comm.setup(cb);
};


exports.startClientHost = function (cb) {
	if (!clientHost) {
		return cb();
	}

	logger.verbose('Starting clientHost...');

	var cfg = mage.core.config.get(['server', 'clientHost'], {});
	var binding = cfg.bind;

	if (!binding || (!binding.hasOwnProperty('port') && !binding.hasOwnProperty('file'))) {
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
					error = 'Port is in use - ' + (binding.host || 'INADDR_ANY') + ':' + binding.port;
					break;
				case 'EACCES':
					error = 'Access denied when trying to bind to ' + (binding.host || 'INADDR_ANY') + ':' + binding.port;
					break;
				}
				return cb(error);
			}

			// TODO - find a way to give a useful address here.
			logger.notice('Server running at ' + cfg.protocol + '://' + address.address + ':' + address.port);

			cb();
		});

		return;
	}

	// unix file socket binding

	var resolvedPath = path.resolve(binding.file);

	logger.debug('ClientHost about to listen on', resolvedPath);

	clientHost.listen(resolvedPath, function (error) {
		if (error) {
			switch (error.code) {
			case 'EADDRINUSE':
				error = resolvedPath + ' already exists. Perhaps the server did not shutdown cleanly. Try removing the file and starting again.';
				break;
			case 'EACCES':
				error = resolvedPath + ' cannot be created. Please check your config file.';
				break;
			}
			return cb(error);
		}

		require('fs').chmod(resolvedPath, parseInt('777', 8));

		logger.notice('Server bound to', resolvedPath);

		cb();
	});
};
