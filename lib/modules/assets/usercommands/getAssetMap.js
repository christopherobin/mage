var mage = require('../../../mage');

exports.params = ['appName'];

exports.access = 'admin';

exports.execute = function (state, appName, cb) {
	mage.assets.getAssetMap(appName, function (error, assetMap) {
		if (error) {
			return state.error(null, error, cb);
		}

		state.respond(assetMap);

		cb();
	});
};
