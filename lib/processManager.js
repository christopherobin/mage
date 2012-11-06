var cluster = require('cluster'),
	path    = require('path'),
	mithril = require('./mithril'),
	logger  = require('./logger');

exports.isMaster = false;
exports.isWorker = false;

var WORKER_STARTUP_TIMEOUT = 60 * 1000;


function createNewWorker() {
	var worker = cluster.fork();
	logger.verbose('[ProcessManager] Forked worker', worker.process.pid);
}

function forEachWorker(fn) {
	for (var id in cluster.workers) {
		var worker = cluster.workers[id];

		fn(worker);
	}
}

if (cluster.isMaster) {
	var startupTimeouts = {};

	cluster.on('fork', function (worker) {
		startupTimeouts[worker.id] = setTimeout(function () {
			logger.error('[ProcessManager] Worker', worker.process.pid, 'is taking too long to respond. Restarting...');
			worker.destroy();
			createNewWorker();
		}, WORKER_STARTUP_TIMEOUT);
	});

	cluster.on('listening', function (worker, address) {
		if (startupTimeouts[worker.id]) {
			clearTimeout(startupTimeouts[worker.id]);
			delete startupTimeouts[worker.id];
		}

		var desc = address.address;

		if (address.port >= 0) {
			desc += ':' + address.port;
		}

		logger.notice('[ProcessManager] Worker', worker.process.pid, 'is now listening at', desc);
	});

	cluster.on('online', function (worker) {
		logger.notice('[ProcessManager] Worker', worker.process.pid, 'is now online.');
	});

	cluster.on('disconnect', function (worker) {
		logger.notice('Worker', worker.process.pid, 'just disconnected.');
	});

	cluster.on('exit', function (worker, code, signal) {
		if (worker.suicide === true) {
			logger.warning('[ProcessManager] Worker', worker.process.pid, 'just committed suicide.');
			return;
		}

		var exitCode = worker.process.exitCode;
		if (!mithril.isShuttingDown) {
			if (exitCode) {
				logger.error('[ProcessManager] Worker', worker.process.pid, 'just died (exit code: ' + exitCode + '). Restarting...');
				createNewWorker();
			} else {
				logger.info('[ProcessManager] Worker', worker.process.pid, 'just exited normally.');
			}
		}
	});

	process.once('SIGINT', function () {
		logger.verbose('Caught SIGINT.');
		mithril.quit(true);
	});

	process.once('SIGTERM', function () {
		logger.verbose('Caught SIGTERM.');
		mithril.quit(true);
	});
} else {
	process.on('message', function (msg) {
		if (msg === 'shutdown') {
			logger.verbose('[ProcessManager] Worker received shutdown request.');

			mithril.quit(true);
		}
	});

	// Disable default signal handlers, as INT and TERM are to be handled by the
	// master (use KILL if you want to nuke a worker on the command line).
	process.on('SIGINT',  function () { });
	process.on('SIGTERM', function () { });
}

process.on('uncaughtException', function (error) {
	logger.error(error);
});

process.on('exit', function () {
	logger.notice('[ProcessManager] Process', process.pid, 'exited.');
});


exports.quit = function (graceful, returnCode) {
	var logPrefix = '[ProcessManager] ' + (cluster.isWorker ? 'Worker' : 'Process') + ' ' + process.pid;
	returnCode = returnCode || 0;
	logger.verbose(logPrefix, 'is about to shut down (graceful: ' + (graceful ? 'yes' : 'no') + ').');

	function exit() {
		logger.notice(logPrefix, 'is exiting with return code:', returnCode);
		process.exit(returnCode);
	}

	if (exports.isMaster) {
		var shutdownGracePeriod = graceful ? mithril.core.config.get('server.shutdownGracePeriod', 15) : 1;

		var killTimeout = setTimeout(
			function () {
				// Workers having already exited are not in cluster.workers anymore

				killTimeout = null;

				forEachWorker(function (worker) {
					logger.error('[ProcessManager] Failed to gracefully stop worker', worker.process.pid, '. Killing it...');
					worker.destroy();
				});

				logger.info('[ProcessManager] Master timed out waiting for workers to die.');

				exit();
			},
			shutdownGracePeriod * 1000
		);

		cluster.on('exit', function () {
			// if no workers remain, we're in a 100% graceful shutdown situation

			if (killTimeout && Object.keys(cluster.workers).length === 0) {
				clearTimeout(killTimeout);
				killTimeout = null;

				logger.notice('[ProcessManager] Graceful shutdown complete.');

				exit();
			}
		});

		// Ask politely first

		logger.verbose('[ProcessManager] Asking all workers to shutdown.');

		forEachWorker(function (worker) {
			worker.send('shutdown');
		});

		cluster.disconnect(function () {
			logger.verbose('[ProcessManager] Workers disconnected.');
		});

	} else {
		exit();
	}
};


exports.start = function () {
	// if server.cluster is falsy, it's a standalone app (default).

	var numberOfWorkers = mithril.core.config.get('server.cluster', 0);

	if (numberOfWorkers === true) {
		numberOfWorkers = require('os').cpus().length;
	}

	if (numberOfWorkers && numberOfWorkers > 0) {
		if (cluster.isMaster) {
			exports.isMaster = true;
		} else {
			exports.isWorker = true;
		}
	}

	// set the process' title

	var cwd = process.cwd();
	var packageInfo;

	try {
		packageInfo = require(path.join(cwd, 'package.json'));
	} catch (e) {
		mithril.core.logger.verbose('Unable to get process info from package.json.');
	}

	var appName = packageInfo && packageInfo.name || path.basename(cwd);
	var appVersion = packageInfo && packageInfo.version || 'no-version';
	var nodeVersion = process.version;

	var processRole = exports.isMaster ? 'master' : (exports.isWorker ? 'worker' : 'single');

	process.title = '[' + processRole + '] ' + appName + '/' + appVersion + ' (Mithril v' + mithril.version + ', Node.js ' + nodeVersion + ')';

	// set up cluster, if required

	if (exports.isMaster) {
		logger.info('Spawning', numberOfWorkers, 'worker processes.');

		while (--numberOfWorkers >= 0) {
			createNewWorker();
		}
	}
};

