var async = require('async');


exports.setup = function (mage, options, cb) {
	// Set up the logging system according to config.

	function setupLogging(callback) {
		mage.core.loggingService.setup(callback);
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
		createApps
	], function (error) {
		if (error) {
			return cb(error);
		}

		cb(null, { allowUserCallback: true });
	});
};


/**
 * Remove all builds
 *
 * @param {Mage} mage
 * @param {Object} options
 * @param {Function} cb
 */

exports.start = function (mage, options, cb) {
	var logger = mage.core.logger.context('build-clean');

	// get all apps

	var apps = mage.core.app.getAppList();

	if (apps.length === 0) {
		logger.warning('There are no apps set up, so there is nothing to clean.');
		return cb(null, { shutdown: true });
	}

	// delete each built app in all its variations

	function cleanApp(app, callback) {
		app.cleanBuilds(callback);
	}

	async.eachSeries(
		apps,
		cleanApp,
		function () {
			cb(null, { shutdown: true });
		}
	);
};


exports.shutdown = function (mage, options, cb) {
	mage.core.loggingService.destroy(cb);
};