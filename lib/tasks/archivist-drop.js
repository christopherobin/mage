var async = require('async');


exports.setup = function (mage, options, cb) {
	async.series([
		function (callback) {
			mage.core.loggingService.setup(callback);
		},
		function (callback) {
			mage.core.archivist.setup(callback);
		}
	], cb);
};


exports.start = function (mage, options, cb) {
	var vaults = mage.core.archivist.getPersistentVaults();
	var vaultNames = Object.keys(vaults);

	async.eachSeries(vaultNames, function (vaultName, callback) {
		var vault = vaults[vaultName];

		if (typeof vault.dropDatabase === 'function') {
			vault.dropDatabase(callback);
		} else {
			mage.core.logger.notice('Vault', vault.name, 'has no drop operation. Skipping.');
			callback();
		}
	}, function (error) {
		if (error) {
			mage.core.logger.emergency(error);
			return cb(error);
		}

		cb(null, { shutdown: true });
	});
};
