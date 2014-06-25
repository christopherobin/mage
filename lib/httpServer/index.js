var mage = require('../mage');
var path = require('path');
var logger = mage.core.logger.context('httpServer');

mage.core.config.setTopLevelDefault('server', path.join(__dirname, 'config.yaml'));

var httpServer;
var cfg = mage.core.config.get(['server', 'clientHost'], {});

if (!mage.core.processManager.isMaster) {
	// Only non-masters have a clientHost

	httpServer = require('./transports/http');
	httpServer.initialize(mage.core.logger.context('http'));

	// configuration

	httpServer.setCorsConfig(cfg.cors);
	httpServer.expose(cfg.expose);
}

exports.getHttpServer = function () {
	return httpServer || null;
};

httpServer.startClientHost = function (cb) {
	if (!httpServer) {
		return cb();
	}

	logger.verbose('Starting httpServer...');

	// default behavior

	httpServer.enableCheckTxt(mage.rootPackage.path);
	httpServer.enableDefaultFavicon();

	// close on shutdown

	mage.once('shutdown', httpServer.close);

	var binding = cfg.bind;

	if (!binding || (!binding.hasOwnProperty('port') && !binding.hasOwnProperty('file'))) {
		logger.notice('No binding configured for clientHost, defaulting to ./server.sock');
		binding = { file: './server.sock' };
	}

	// tcp binding

	if (binding.hasOwnProperty('port')) {
		logger.debug('httpServer about to listen on port', binding.port);

		// binding.host is optional and may be undefined (translates to INADDR_ANY)

		httpServer.listen(binding.port, binding.host, function (error, address) {
			if (error) {
				var addr = (binding.host || 'INADDR_ANY') + ':' + binding.port;

				switch (error.code) {
					case 'EADDRINUSE':
						error = 'Port is in use - ' + addr;
						break;
					case 'EACCES':
						error = 'Access denied when trying to bind to ' + addr;
						break;
				}
				return cb(error);
			}

			// TODO - find a way to give a useful address here.
			logger.notice('Server running at zmq://' + address.address + ':' + address.port);

			cb();
		});

		return;
	}

	// unix file socket binding

	var resolvedPath = path.resolve(binding.file);

	logger.debug('httpServer about to listen on', resolvedPath);

	httpServer.listen(resolvedPath, function (error) {
		if (error) {
			switch (error.code) {
				case 'EADDRINUSE':
					error = resolvedPath + ' already exists. Perhaps the server did not shutdown ' +
						'cleanly. Try removing the file and starting again.';
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
