var mage = require('../../../mage');

exports.access = 'anonymous';

exports.params = [];

exports.execute = function (state, cb) {
	state.respond(mage.ident.getPublicEngineList());
	cb();
};
