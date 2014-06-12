// this builder can inject strings that are information about the app that is being built.

var mage = require('../../mage');

exports.build = function (buildTarget, clientConfig, req, contextName, key, cb) {
	var app = buildTarget.app;

	if (!app) {
		mage.core.logger.error('Cannot build app information, because buildTarget has no app.');
		return cb(null, 'undefined');
	}

	function respond(data) {
		cb(null, JSON.stringify(data));
	}

	switch (key) {
	case 'name':
		return respond(app.name || '');
	case 'variants':
		return respond({ languages: app.languages, densities: app.densities });
	case 'clientHostBaseUrl':
		return respond(mage.core.httpServer.getClientHostBaseUrl(req && req.headers));
	case 'developmentMode':
		return respond(mage.isDevelopmentMode());
	case 'savvyBaseUrl':
		return respond(mage.core.savvy.getBaseUrl(req && req.headers));
	default:
		mage.core.logger.error('Cannot build app information for unknown key:', key);
		return cb(null, 'undefined');
	}
};

