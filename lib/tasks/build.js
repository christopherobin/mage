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
 * Builds all apps into ./build
 *
 * @param {Mage} mage
 * @param {Object} options
 * @param {Function} cb
 */

exports.start = function (mage, options, cb) {
	var logger = mage.core.logger.context('build');

	// get all apps

	var apps = mage.core.app.getAppList();

	if (apps.length === 0) {
		logger.warning('There are no apps set up, so there is nothing to build.');
		return cb(null, { shutdown: true });
	}

	// build each app in all its variations

	function buildApp(app, callback) {
		if (!app.prebuild) {
			logger.notice('App', app.name, 'was not set up to be prebuilt.');
			app.prebuild = true;
		}

		async.series([
			function (callback) {
				// clean so we cannot accidentally load builds

				app.cleanBuilds(callback);
			},
			function (callback) {
				// make all builds

				app.makeBuilds(callback);
			},
			function (callback) {
				// store the created builds

				app.storeBuilds(callback);
			}
		], callback);
	}

	async.eachSeries(
		apps,
		buildApp,
		function (error) {
			if (error) {
				logger.emergency(error);
				return mage.quit(1);
			}

			cb(null, { shutdown: true });
		}
	);
};


exports.shutdown = function (mage, options, cb) {
	mage.core.loggingService.destroy(cb);
};