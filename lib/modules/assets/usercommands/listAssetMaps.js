var mage = require('../../../mage');

exports.params = [];

exports.acl = ['admin'];

exports.execute = function (state, cb) {
	state.respond(mage.assets.listAssetMaps());

	cb();
};
