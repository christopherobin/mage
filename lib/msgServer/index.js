var mage = require('../mage');
var path = require('path');
var comm = require('./comm');
var logger = mage.core.logger.context('msgServer');

exports.comm = comm;

mage.core.config.setTopLevelDefault('server', path.join(__dirname, 'config.yaml'));

// HTTP server

var clientHost = require('./transports/http');
clientHost.initialize(mage.core.logger.context('http'));
clientHost.setCorsConfig(mage.core.config.get(['server', 'clientHost', 'cors']));
clientHost.expose(mage.core.config.get(['server', 'clientHost', 'expose']));


exports.getClientHost = function () {
	return clientHost;
};

exports.getHttpServer = function () {
	return clientHost;
};


exports.listPeerDependencies = function () {
	return {
		'MMRP ZeroMQ transport': ['zmq']
	};
};


// startup messaging server

exports.setup = function (cb) {
	// Set up comm library

	comm.setup(cb);
};


exports.startClientHost = function (cb) {
	logger.verbose('Starting clientHost...');

	clientHost.enableCheckTxt(mage.rootPackage.path);
	clientHost.enableDefaultFavicon();

	// close on shutdown

	mage.once('shutdown', clientHost.close);

	var binding = mage.core.config.get(['server', 'clientHost', 'bind']);

	if (!binding || (!binding.hasOwnProperty('port') && !binding.hasOwnProperty('file'))) {
		binding = { file: './server.sock' };

		logger.notice('No binding configured for clientHost, falling back to', binding);
	}

	clientHost.listen(binding, cb);
};
