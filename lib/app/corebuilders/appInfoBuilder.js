// this builder can inject strings that are information about the app that is being built.

var mage = require('../../mage');

exports.build = function (buildTarget, clientConfig, contextName, key, cb) {
	var app = buildTarget.app;
	if (!app) {
		mage.core.logger.error('Cannot build app information, because buildTarget has no app.');
		return cb(null, '');
	}

	switch (key) {
	case 'name':
		cb(null, JSON.stringify(app.name || ''));
		break;
	case 'variants':
		cb(null, JSON.stringify({
			languages: app.languages,
			densities: app.densities
		}));
		break;
	case 'clientHostBaseUrl':
		cb(null, JSON.stringify(mage.core.msgServer.getClientHost().getClientHostBaseUrl()));
		break;
	case 'developmentMode':
		cb(null, JSON.stringify(mage.isDevelopmentMode()));
		break;
	default:
		mage.core.logger.error('Cannot build app information for unknown key:', key);
		cb(null, '');
		break;
	}
};

