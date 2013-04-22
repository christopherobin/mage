var mage = require('../../../mage');

exports.access = 'anonymous';

exports.params = ['names'];

exports.execute = function (state, names, cb) {
	state.respond(mage.assets.AssetMap.query(names));
	cb();
};
