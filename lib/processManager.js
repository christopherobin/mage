var cluster = require('cluster'),
	path    = require('path'),
	mithril = require('./mithril'),
	logger  = require('./logger');

exports.isMaster = false;
exports.isWorker = false;


function createNewWorker() {
	var worker = cluster.fork();
	logger.info('[ProcessManager] Forked worker ' + worker.process.pid + '.');
}


if (cluster.isMaster) {
	var startupTimeouts = [];

	cluster.on('fork', function (worker) {
		startupTimeouts[worker.id] = setTimeout(function () {
			logger.error('[ProcessManager] Worker ' + worker.process.pid + ' is taking too long to respond. Restarting...');
			worker.destroy();
			createNewWorker();
		}, 15000);
	});

	cluster.on('listening', function (worker, address) {
		if (startupTimeouts[worker.id]) {
			clearTimeout(startupTimeouts[worker.id]);
			delete startupTimeouts[worker.id];
		}

		logger.info('[ProcessManager] Worker ' + worker.process.pid + ' is now listening at "' + address.address + ':' + address.port + '".');
	});

	cluster.on('online', function (worker) {
		logger.info('[ProcessManager] Worker ' + worker.process.pid + ' is now online.');
	});

	cluster.on('disconnect', function (worker) {
		logger.info('[ProcessManager] Worker ' + worker.process.pid + ' just disconnected.');
	});

	cluster.on('exit', function (worker, code, signal) {
		if (worker.suicide === true) {
			logger.info('[ProcessManager] Worker ' + worker.process.pid + ' just committed suicide.');
			return;
		}

		var exitCode = worker.process.exitCode;
		if (!mithril.isShuttingDown) {
			if (exitCode) {
				logger.error('[ProcessManager] Worker ' + worker.process.pid + ' just died (exit code: ' + exitCode + '). Restarting...');
				createNewWorker();
			} else {
				logger.info('[ProcessManager] Worker ' + worker.process.pid + ' just exited normally.');
			}
		}
	});

	process.once('SIGINT', function () {
		logger.info('Caught SIGINT.');
		mithril.quit(false);
	});

	process.once('SIGTERM', function () {
		logger.info('Caught SIGTERM.');
		mithril.quit(true);
	});
} else {
	process.once('disconnect', function () {
		logger.info('[ProcessManager] Worker ' + process.pid + ' just received a disconnection request.');
		mithril.quit(true);
	});

	// Disable default signal handlers, as INT and TERM are to be handled by the
	// master (use KILL if you want to nuke a worker on the command line).
	process.on('SIGINT',  function () { });
	process.on('SIGTERM', function () { });
}

process.on('uncaughtException', function (error) {
	logger.error(error.stack);
});

process.on('exit', function () {
	logger.info('[ProcessManager] Process', process.pid, 'exited.');
});

exports.quit = function (graceful, returnCode) {
	var logPrefix = '[ProcessManager] ' + (cluster.isWorker ? 'Worker' : 'Process') + ' ' + process.pid;
	returnCode = returnCode || 0;
	logger.info(logPrefix, 'is about to shut down.');

	function exit() {
		logger.info(logPrefix, 'is exiting with return code:', returnCode);
		process.exit(returnCode);
	}

	function killAll() {
		logger.info('[ProcessManager] Graceful termination failed.');

		// Workers having already exited are not in cluster.workers anymore
		for (var id in cluster.workers) {
			var worker = cluster.workers[id];
			logger.error('[ProcessManager] Failed to gracefully stop worker', worker.process.pid, '. Killing it...');
			worker.destroy();
		}
		exit();
	}

	if (cluster.isMaster) {
		var shutdownGracePeriod = graceful ? mithril.core.config.get('server.shutdownGracePeriod', 15) : 1;
		var killTimeout = setTimeout(killAll, shutdownGracePeriod * 1000);

		// Ask politely first
		cluster.disconnect(function () {
			logger.info('[ProcessManager] Graceful termination successful.');
			clearTimeout(killTimeout);
			exit();
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

	var packageInfo = require(path.join(cwd, 'package.json'));
	var appName = packageInfo.name || path.basename(cwd);
	var appVersion = packageInfo.version || 'no-version';
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

