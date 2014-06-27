var mage = require('../mage');
var path = require('path');
var logger = mage.core.logger.context('httpServer');

mage.core.config.setTopLevelDefault('server', path.join(__dirname, 'config.yaml'));

var httpServer = require('./transports/http');
httpServer.initialize(mage.core.logger.context('http'));
httpServer.setCorsConfig(mage.core.config.get(['server', 'clientHost', 'cors']));
httpServer.expose(mage.core.config.get(['server', 'clientHost', 'expose']));

exports.getHttpServer = function () {
	return httpServer || null;
};

httpServer.startClientHost = function (cb) {

	logger.verbose('Starting httpServer...');

	// default behavior

	httpServer.enableCheckTxt(mage.rootPackage.path);
	httpServer.enableDefaultFavicon();

	// close on shutdown

	mage.once('shutdown', httpServer.close);

	var binding = mage.core.config.get(['server', 'clientHost', 'bind']);

	if (!binding || (!binding.hasOwnProperty('port') && !binding.hasOwnProperty('file'))) {
		binding = { file: './server.sock' };
		logger.notice('No binding configured for clientHost, falling back to', binding);
	}

	httpServer.listen(binding, cb);
};
