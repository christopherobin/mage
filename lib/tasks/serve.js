// Starts all services that allow users to connect

var async = require('async');


exports.setup = function (mage, options, cb) {
	// set up the appMaster logic on the daemonizor, creating a PID file, etc.

	function setupDaemonizerCallbacks(callback) {
		require('../daemon').appMaster();
		callback();
	}

	// Set up the logging system according to config.

	function setupLogging(callback) {
		mage.core.loggingService.setup(callback);
	}

	// Set up the archivist

	function setupArchivist(callback) {
		mage.core.archivist.setup(callback);
	}

	// Set up the msgServer. This will:
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
		if (mage.core.processManager.isMaster) {
			return callback();
		}

		mage.core.app.createApps();

		if (mage.dashboard) {
			mage.dashboard.setupDashboardApps(callback);
		} else {
			callback();
		}
	}

	// Set up heapdump on SIGUSR2 for workers

	function setupHeapDump(callback) {
		if (!mage.core.processManager.isWorker) {
			return callback();
		}

		try {
			require('heapdump');
		} catch (error) {
			return callback(error);
		}

		return callback();
	}

	// Time to run each step!

	async.series([
		setupDaemonizerCallbacks,
		setupLogging,
		setupArchivist,
		setupMsgServer,
		setupSampler,
		setupModules,
		createApps,
		setupHeapDump
	], function (error) {
		if (error) {
			mage.core.logger.emergency(error);
			return cb(error);
		}

		cb(null, { allowUserCallback: !mage.core.processManager.isMaster });
	});
};


exports.start = function (mage, options, cb) {
	function makeBuilds(callback) {
		if (mage.core.processManager.isMaster) {
			callback();
		} else {
			mage.core.app.buildApps(callback);
		}
	}

	function exposeApps(callback) {
		if (mage.core.processManager.isMaster) {
			callback();
		} else {
			try {
				mage.core.app.exposeAppsOnClientHost();
			} catch (error) {
				return callback(error);
			}

			return callback();
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
		mage.core.savvy.start(callback);
	}

	function startClientHost(callback) {
		if (mage.core.processManager.isMaster) {
			callback();
		} else {
			mage.core.httpServer.startClientHost(callback);
		}
	}

	function startProcessManager(callback) {
		mage.core.processManager.start(callback);
	}

	async.series([
		makeBuilds,
		exposeApps,
		exposeSampler,
		startSavvy,
		startClientHost,
		startProcessManager
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


exports.shutdown = function (mage, options, cb) {
	function closeVaults(callback) {
		mage.core.archivist.closeVaults();
		callback();
	}

	function closeLogger(callback) {
		mage.core.loggingService.destroy(callback);
	}

	function quit(callback) {
		if (mage.core.processManager) {
			mage.core.processManager.quit(callback);
		} else {
			process.nextTick(callback);
		}
	}

	async.series([
		closeVaults,
		closeLogger,
		quit
	], cb);
};
