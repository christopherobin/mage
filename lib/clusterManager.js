var cluster = require('cluster'),
	mithril = require('./mithril');

exports.isMaster = false;
exports.isWorker = false;


function createNewWorker() {
	var worker = cluster.fork();
	mithril.core.logger.info('[ClusterManager] Forked worker #' + worker.id + '.');
}

if (cluster.isMaster) {
	var startupTimeouts = [];

	cluster.on('fork', function (worker) {
		startupTimeouts[worker.id] = setTimeout(function () {
			mithril.core.logger.error('[ClusterManager] Worker #' + worker.id + ' is taking too long to respond. Restarting...');
			worker.destroy();
			createNewWorker();
		}, 15000);
	});

	cluster.on('listening', function (worker, address) {
		if (startupTimeouts[worker.id]) {
			clearTimeout(startupTimeouts[worker.id]);
			delete startupTimeouts[worker.id];
		}

		mithril.core.logger.info('[ClusterManager] Worker #' + worker.id + ' is now listening at "' + address.address + ':' + address.port + '".');
	});

	cluster.on('online', function (worker) {
		mithril.core.logger.info('[ClusterManager] Worker #' + worker.id + ' is now online.');
	});

	cluster.on('disconnect', function (worker) {
		mithril.core.logger.info('[ClusterManager] Worker #' + worker.id + ' just disconnected.');
	});

	cluster.on('exit', function (worker, code, signal) {
		if (worker.suicide === true) {
			mithril.core.logger.info('[ClusterManager] Worker #' + worker.id + ' just committed suicide.');
			return;
		}

		var exitCode = worker.process.exitCode;
		if (!mithril.isShuttingDown) {
			if (exitCode) {
				mithril.core.logger.error('[ClusterManager] Worker #' + worker.id + ' just died (exit code: ' + exitCode + '). Restarting...');
				createNewWorker();
			} else {
				mithril.core.logger.info('[ClusterManager] Worker #' + worker.id + ' just exited normally.');
			}
		}
	});
}


exports.quit = function (graceful, returnCode) {
	returnCode = returnCode || 0;

	function killAll() {
		// Workers having already exited are not in cluster.workers anymore
		for (var id in cluster.workers) {
			if (graceful) {
				mithril.core.logger.error('[ClusterManager] Failed to gracefully stop worker #' + id + '. Killing it...');
			}
			cluster.workers[id].destroy();
		}
		mithril.core.logger.info('[ClusterManager] Exiting with return code = ' + returnCode);
		process.exit(returnCode);
	}

	if (cluster.isMaster) {
		if (graceful) {
			var shutdownGracePeriod = mithril.core.config('server.shutdownGracePeriod', 8),
				killTimeout = setTimeout(killAll, shutdownGracePeriod * 1000);

			// Ask politely first
			cluster.disconnect(function () {
				clearTimeout(killTimeout);
				mithril.core.logger.info('[ClusterManager] Exiting with return code = ' + returnCode);
				process.exit(returnCode);
			});
		} else {
			// exit this process, killing whatever subprocess we spawned
			killAll();
		}
	} else {
		mithril.core.logger.info('[ClusterManager] Exiting with return code = ' + returnCode);
		process.exit(returnCode);
	}
};


exports.start = function () {
	// set up cluster, if required
	var numberOfWorkers = +mithril.core.config.get('server.cluster', 0);
	if (numberOfWorkers > 0) {
		if (cluster.isMaster) {
			while (--numberOfWorkers >= 0) {
				createNewWorker();
			}
			mithril.core.logger.info('[ClusterManager] Master is done.');
			exports.isMaster = true;
			return true;
		}

		exports.isWorker = true;
	}

	return false;
};

