var mage = require('../../../mage');

exports.params = [];

exports.access = 'admin';

exports.execute = function (state, cb) {
	state.respond(mage.assets.listAssetMaps());

	cb();
};
