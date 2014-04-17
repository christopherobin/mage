var async = require('async');


exports.setup = function (mage, options, cb) {
	// Set up the logging system according to config.

	function setupLogging(callback) {
		mage.core.loggingService.setup(callback);
	}

	// Set up the archivist

	function setupArchivist(callback) {
		mage.core.archivist.setup(callback);
	}

	// Set up the modules

	function setupModules(callback) {
		mage.setupModules(callback);
	}

	// Create the apps

	function createApps(callback) {
		mage.core.app.createApps();

		if (mage.dashboard) {
			mage.dashboard.setupDashboardApps(callback);
		} else {
			callback();
		}
	}

	async.series([
		setupLogging,
		setupArchivist,
		setupModules,
		createApps
	], function (error) {
		if (error) {
			return cb(error);
		}

		cb(null, { allowUserCallback: true });
	});
};


/**
 * Index all assets
 *
 * @param {Mage} mage
 * @param {Object} options
 * @param {Function} cb
 */

exports.start = function (mage, options, cb) {
	var logger = mage.core.logger.context('assets-index');

	// get all apps

	var apps = mage.core.app.getAppList();

	if (apps.length === 0) {
		logger.warning('There are no apps set up, so there are no assets to index.');
		return cb(null, { shutdown: true });
	}

	// delete each built app in all its variations

	function indexAssets(app, callback) {
		var assetFolders = app.assetMap.src.folders;

		async.eachSeries(assetFolders, function (folder, folderCallback) {
			app.assetMap.indexFolder(folder, folderCallback);
		}, callback);
	}

	async.eachSeries(
		apps,
		indexAssets,
		function () {
			cb(null, { shutdown: true });
		}
	);
};


exports.shutdown = function (mage, options, cb) {
	mage.core.archivist.closeVaults();
	cb();
};