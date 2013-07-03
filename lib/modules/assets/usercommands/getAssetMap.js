var mage = require('../../../mage');

exports.params = ['appName', 'forceReindex'];

exports.access = 'admin';

exports.execute = function (state, appName, forceReindex, cb) {
	mage.assets.getAssetMap(appName, forceReindex, function (error, assetMap) {
		if (error) {
			return state.error(null, error, cb);
		}

		state.respond(assetMap);

		cb();
	});
};
