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
			if (options.force) {
				logger.notice('App', app.name, 'was not set up to be prebuilt. Building with force.');
				app.prebuild = true;
			} else {
				logger.warning('App', app.name, 'was not set up to be prebuilt. Use "build -f" to force.');
				return callback();
			}
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
		function () {
			cb(null, { shutdown: true });
		}
	);
};
