var mage = require('../mage');
var path = require('path');
var assert = require('assert');
var logger = mage.core.logger.context('httpServer');
var url = require('url');

mage.core.config.setTopLevelDefault('server', path.join(__dirname, 'config.yaml'));

var httpServer = require('./transports/http');

httpServer.initialize(mage.core.logger.context('http'), mage.core.config.get(['server']));

exports.getHttpServer = function () {
	return httpServer || null;
};


exports.parseBinding = function (binding) {
	function stripLeadingSlash(str) {
		if (str && str[0] === '/') {
			return str.substr(1);
		}

		return str;
	}

	assert(binding, 'No binding configured for HTTP Server');

	if (typeof binding === 'string') {
		var parsed = url.parse(binding);

		if (parsed.protocol === 'unix:') {
			return {
				file: stripLeadingSlash(parsed.hostname + parsed.pathname)
			};
		}

		if (parsed.protocol === 'http:' && parsed.hostname === 'unix') {
			return {
				file: stripLeadingSlash(parsed.pathname)
			};
		}

		if (parsed.protocol === 'http:' || parsed.protocol === 'tcp:') {
			return {
				host: parsed.hostname || '0.0.0.0',
				port: typeof parsed.port === 'string' ? parseInt(parsed.port, 10) : (parsed.port || 0)
			};
		}

		throw new Error('Could not parse bind URI: ' + binding);
	}

	if (typeof binding === 'object') {
		if (binding.file) {
			// drop other properties

			return {
				file: binding.file
			};
		}

		if (binding.hasOwnProperty('host') || binding.hasOwnProperty('port')) {
			return {
				host: binding.host || '0.0.0.0',
				port: typeof binding.port === 'string' ? parseInt(binding.port, 10) : (binding.port || 0)
			};
		}
	}

	throw new Error('Could not parse binding configuration: ' + binding);
};


httpServer.startClientHost = function (cb) {
	logger.verbose('Starting httpServer...');

	// Add some default routes

	httpServer.enableCheckTxt(mage.rootPackage.path);

	if (!httpServer.hasFavicon()) {
		httpServer.enableDefaultFavicon();
	}

	// close on shutdown

	mage.once('shutdown', httpServer.close);

	var binding = mage.core.config.get(['server', 'clientHost', 'bind']);

	try {
		binding = exports.parseBinding(binding);
	} catch (error) {
		return setImmediate(function () {
			cb(error);
		});
	}

	httpServer.listen(binding, cb);
};
