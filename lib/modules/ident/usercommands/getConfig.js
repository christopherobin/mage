var mage = require('../../../mage');

exports.access = 'admin';

exports.params = [];

exports.execute = function (state, cb) {
	// just return the config as is
	state.respond(mage.core.config.get(['module', 'ident', 'apps']) || {});
	cb();
};
