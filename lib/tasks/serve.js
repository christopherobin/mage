// Starts all services that allow users to connect

var async = require('async');


exports.setup = function (mage, options, cb) {
	// Set up the logging system according to config.

	function setupLogging(callback) {
		mage.core.loggingService.setup(callback);
	}

	// Set up the process manager.

	function setupProcessManager(callback) {
		mage.core.processManager.setup(callback);
	}

	// Set up the archivist

	function setupArchivist(callback) {
		mage.core.archivist.setup(callback);
	}

	// Set up the msgServer. This will:
	// - set up a clientHost (HTTP server) for workers and standalone
	// - connect to peers in the network for master and standalone

	function setupMsgServer(callback) {
		mage.core.msgServer.setup(callback);
	}

	// Set up the sampler.

	function setupSampler(callback) {
		mage.core.sampler.setup(callback);
	}

	// Set up the modules

	function setupModules(callback) {
		if (mage.core.processManager.isMaster) {
			callback();
		} else {
			mage.setupModules(callback);
		}
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

	// Time to run each step!

	async.series([
		setupLogging,
		setupProcessManager,
		setupArchivist,
		setupMsgServer,
		setupSampler,
		setupModules,
		createApps
	], function (error) {
		if (error) {
			return cb(error);
		}

		cb(null, { allowUserCallback: !mage.core.processManager.isMaster });
	});
};


exports.start = function (mage, options, cb) {
	function startProcessManager(callback) {
		mage.core.processManager.start(callback);
	}

	function exposeApps(callback) {
		if (mage.core.processManager.isMaster) {
			callback();
		} else {
			mage.core.app.exposeAppsOnClientHost(callback);
		}
	}

	function exposeSampler(callback) {
		if (mage.core.processManager.isWorker) {
			callback();
		} else {
			mage.core.sampler.expose(callback);
		}
	}

	function startSavvy(callback) {
		if (mage.core.processManager.isWorker) {
			callback();
		} else {
			mage.core.savvy.start(callback);
		}
	}

	function startClientHost(callback) {
		if (mage.core.processManager.isMaster) {
			callback();
		} else {
			mage.core.msgServer.startClientHost(callback);
		}
	}

	async.series([
		startProcessManager,
		exposeApps,
		exposeSampler,
		startSavvy,
		startClientHost
	],
	function (error) {
		if (error) {
			mage.core.logger.emergency(error);
			return cb(error);
		}

		mage.setRunState('running');

		cb(null, { allowUserCallback: !mage.core.processManager.isMaster });
	});
};
