var mage = require('../../../mage');

exports.params = ['appName', 'context', 'oldIdent', 'newIdent'];

exports.access = 'admin';


exports.execute = function (state, appName, context, oldIdent, newIdent, cb) {
	mage.assets.renameAsset(state, appName, context, oldIdent, newIdent, function (error, newLocalizedAssets) {
		if (error) {
			return cb(error);
		}

		state.respond(newLocalizedAssets);

		cb();
	});
};
