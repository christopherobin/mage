var async = require('async');

module.exports = function (mage) {
	var vaults = mage.core.archivist.getPersistentVaults();
	var vaultNames = Object.keys(vaults);

	async.eachSeries(vaultNames, function (vaultName, callback) {
		var vault = vaults[vaultName];

		if (typeof vault.createDatabase === 'function') {
			vault.createDatabase(callback);
		} else {
			mage.core.logger.notice('Vault', vault.name, 'has no create operation. Skipping.');
			callback();
		}
	}, function (error) {
		if (error) {
			return mage.fatalError(error);
		}

		mage.quit(true);
	});
};
