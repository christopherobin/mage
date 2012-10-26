var cluster = require('cluster'),
	path	= require('path'),
	mithril = require('./mithril'),
	daemon	= require('./daemon'),
	EventEmitter = require('events').EventEmitter,
	logger	= require('./logger');

var processManager = module.exports = new EventEmitter();

processManager.isMaster = false;
processManager.isWorker = false;

var WORKER_STARTUP_TIMEOUT = 60 * 1000;

function createNewWorker() {
	var worker = cluster.fork();
	logger.info('[ProcessManager] Forked worker', worker.process.pid);
	return worker;
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

		logger.info('[ProcessManager] Worker', worker.process.pid, 'is now listening at', desc);
	});

	cluster.on('online', function (worker) {
		logger.info('[ProcessManager] Worker', worker.process.pid, 'is now online.');
	});

	cluster.on('disconnect', function (worker) {
		logger.info('[ProcessManager] Worker', worker.process.pid, 'just disconnected.');
	});

	cluster.on('exit', function (worker, code, signal) {
		if (worker.suicide === true) {
			logger.info('[ProcessManager] Worker', worker.process.pid, 'just committed suicide.');
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
		logger.info('Caught SIGINT.');
		mithril.quit(true);
	});

	process.once('SIGTERM', function () {
		logger.info('Caught SIGTERM.');
		mithril.quit(true);
	});

	process.once('SIGCONT', function () {
		logger.info('Status request received, we are up and running');
	});
} else {
	process.on('message', function (msg) {
		if (msg === 'shutdown') {
			logger.info('[ProcessManager] Worker received shutdown request.');

			mithril.quit(true);
		}
	});

	// Disable default signal handlers, as INT and TERM are to be handled by the
	// master (use KILL if you want to nuke a worker on the command line).
	process.on('SIGINT',  function () { });
	process.on('SIGTERM', function () { });
}

if (!daemon.isCommander()) {
	process.on('uncaughtException', function (error) {
		logger.error(error.stack);
	});

	process.on('exit', function () {
		logger.info('[ProcessManager] Process', process.pid, 'exited.');
	});
}


processManager.quit = function (graceful, cb) {

	var logPrefix = '[ProcessManager] ' + (cluster.isWorker ? 'Worker' : 'Process') + ' ' + process.pid;
	logger.info(logPrefix, 'is about to shut down (graceful: ' + (graceful ? 'yes' : 'no') + ').');

	if (processManager.isMaster) {
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

				cb(0);
			},
			shutdownGracePeriod * 1000
		);

		cluster.on('exit', function () {
			// if no workers remain, we're in a 100% graceful shutdown situation

			if (killTimeout && Object.keys(cluster.workers).length === 0) {
				clearTimeout(killTimeout);
				killTimeout = null;

				logger.info('[ProcessManager] Graceful shutdown complete.');

				cb(0);
			}
		});

		// Ask politely first

		logger.info('[ProcessManager] Asking all workers to shutdown.');

		forEachWorker(function (worker) {
			worker.send('shutdown');
		});

		cluster.disconnect(function () {
			logger.info('[ProcessManager] Workers disconnected.');
		});

	} else {
		cb(0);
	}
};


processManager.start = function (cb) {

	// if server.cluster is falsy, it's a standalone app (default).

	var numberOfWorkers = mithril.core.config.get('server.cluster', 0);

	if (numberOfWorkers === true) {
		numberOfWorkers = require('os').cpus().length;
	}

	if (numberOfWorkers && numberOfWorkers > 0) {
		if (cluster.isMaster) {
			processManager.isMaster = true;
		} else {
			processManager.isWorker = true;
		}
	}

	// set the process' title

	var cwd = process.cwd();
	var packageInfo;

	try {
		packageInfo = require(path.join(cwd, 'package.json'));
	} catch (e) {
		mithril.core.logger.debug('Unable to get process info from package.json.');
	}

	var appName = packageInfo && packageInfo.name || path.basename(cwd);
	var appVersion = packageInfo && packageInfo.version || 'no-version';
	var nodeVersion = process.version;

	var processRole = processManager.isMaster ? 'master' : (processManager.isWorker ? 'worker' : 'single');

	process.title = '[' + processRole + '] ' + appName + '/' + appVersion + ' (Mithril v' + mithril.version + ', Node.js ' + nodeVersion + ')';

	// set up cluster, if required

	if (processManager.isMaster) {
		logger.info('Spawning', numberOfWorkers, 'worker processes.');

		var workersNotReady = numberOfWorkers;
		var worker;

		var checkIfEveryoneListening = function () {
			workersNotReady--;

            processManager.emit('workers.leftToSpawn', workersNotReady);

            if (workersNotReady === 0) {
                cb();
            }
		};

		while (--numberOfWorkers >= 0) {
			worker = createNewWorker();
			worker.once('listening', checkIfEveryoneListening);
		}
	}
	else {
		cb();
	}
};

