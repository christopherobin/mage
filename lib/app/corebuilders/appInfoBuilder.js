// this builder can inject strings that are information about the app that is being built.

var mithril = require('../../mithril'),
    config = mithril.core.config;


exports.build = function (buildTarget, language, contextName, key, cb) {
	var app = buildTarget.app;
	if (!app) {
		mithril.core.logger.error('Cannot build app information, because buildTarget has no app.');
		return cb(null, '');
	}

	switch (key) {
	case 'name':
		cb(null, app.name || '');
		break;
	case 'language':
		cb(null, language);
		break;
	default:
		mithril.core.logger.error('Cannot build app information for unknown key:', key);
		cb(null, '');
		break;
	}
};

