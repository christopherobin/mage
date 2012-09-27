var cluster = require('cluster'),
	path	= require('path'),
	mithril = require('./mithril'),
	colors	= require('colors'),
	daemon	= require('daemon'),
	fs		= require('fs'),
	logger	= require('./logger');

exports.isMaster = false;
exports.isWorker = false;

var WORKER_STARTUP_TIMEOUT = 60 * 1000;
var LOCKFILE = './.pidfile';


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

process.on('uncaughtException', function (error) {
	logger.error(error.stack);
});

process.on('exit', function () {
	logger.info('[ProcessManager] Process', process.pid, 'exited.');
});


exports.quit = function (graceful, returnCode) {
	var logPrefix = '[ProcessManager] ' + (cluster.isWorker ? 'Worker' : 'Process') + ' ' + process.pid;
	returnCode = returnCode || 0;
	logger.info(logPrefix, 'is about to shut down (graceful: ' + (graceful ? 'yes' : 'no') + ').');

	function exit() {
		logger.info(logPrefix, 'is exiting with return code:', returnCode);
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

				logger.info('[ProcessManager] Graceful shutdown complete.');

				exit();
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
		exit();
	}
};

exports.daemonRunningStatus = function (pid) {

	var currentPid, testPid;

	if (!currentPid && !pid) {
		try {
			currentPid = fs.readFileSync(LOCKFILE);
		}
		catch (e) {
			return -1;
		}
	}

	testPid = pid ? pid : currentPid;

	try {
		process.kill(testPid, 'SIGCONT');
		return testPid;
	} catch(e) {
		return -2;
	}
}

exports.start = function (cb, restarted) {

	// Command manager for daemonization
	switch (process.argv[2]) {

		// Here, we start either in daemon mode or inline
		// In both case, we check if we have a pid file
		case undefined:
		case 'start':
		var pid = this.daemonRunningStatus();
		if (pid > 0) {
			logger.error('Already running (pid:' + pid + '), exiting...');
			return process.exit(1);
		}

		logger.debug('Not running, starting...');
		break;

		// Restart logic
		case 'restart':
		if (cluster.isMaster && !restarted) {

			var start				  = this.start;
			var daemonRunningStatus   = this.runningStatus;

			daemon.kill(LOCKFILE, function (err, pid) {

				var shutdownGracePeriod = mithril.core.config.get('server.shutdownGracePeriod', 15);

				if (err) {
					if (err.errno === 34) {
						logger.error('Mithril was not running, starting...');
					}
					else if (err.errno === 'ESRCH') {
						logger.error('Mithril was not running (process', pid, 'was dead), restarting...');
					}
					return start(cb, true);
				}

				if (err) {
					logger.error('Could not stop process sucessfully: ', err)
					return process.exit(1);
				}

				logger.debug('Shutdown completed, restarting...');

				return setTimeout(function (counter) {
					counter++;
					if (daemonRunningStatus(pid) > 0) {
						if (counter < shutdownGracePeriod) {
							logger.debug('Sleeping for ', counter, 'seconds...');
							setTimeout(arguments.callee, 1000, counter);
						}
						else {
							logger.error('Mithril is not dying. Try "kill -9 ' + pid + '"');
							process.exit(1);
						}

						return;
					}

					start(cb, true);
				}, 1000, 0);
			});

			return;
		}

		break;

		case 'stop':
		daemon.kill(LOCKFILE, function (err, pid) {

			if (err && err.errno !== 34) {
				logger.error('Could not stop process sucessfully: ', err)
				process.exit(1);
			}

			if (err && err.errno === 34) {
				logger.error('Mithril was not running, exiting...');
			}

			process.exit(0);
		});
		return;
		break;

		case 'reload':
		var pid = this.daemonRunningStatus();
		if (pid < 0) {
			logger.error('Not running, so not reloading, exiting...');
			return process.exit(Math.abs(pid));
		}

		try {
			process.kill(pid, 'SIGUSR2');
			logger.info('Reloading...');
			return process.exit(0);
		} catch(e) {
			logger.error('Could not reload, process', pid, 'is not running...');
			return process.exit(2);
		}
		break;

		case 'status':
		var pid = this.daemonRunningStatus();
		if (pid === -1) {
			logger.error('Status: Not running');
			return process.exit(1);
		}
		if (pid === -2) {
			logger.error('Status: Dead (pid:', pid + ')');
			return process.exit(2);
		}

		logger.info('Status: Running');
		return process.exit(0);

		break;

		// We give options as to what can be done with mithril in cli
		default:
		logger.error("        	 _ _   _          _ _".blue.bold);
		logger.error(" _ __ ___ (_) |_| |__  _ __(_) |".blue.bold);
		logger.error("| '_ ` _ \\| | __| '_ \\| '__| | |".blue.bold);
		logger.error("| | | | | | | |_| | | | |  | | |".blue.bold);
		logger.error("|_| |_| |_|_|\\__|_| |_|_|  |_|_|".blue.bold);
		logger.error('÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷');
		logger.error('Usage (as daemon)		 :'.magenta.bold, 'node . [start|stop|restart|reload|status]');
		logger.error('Usage (to run in shell):'.magenta.bold, 'node .');
		logger.error('÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷');
		return process.exit(1);
		break;
	}

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
		mithril.core.logger.debug('Unable to get process info from package.json.');
	}

	var appName = packageInfo && packageInfo.name || path.basename(cwd);
	var appVersion = packageInfo && packageInfo.version || 'no-version';
	var nodeVersion = process.version;

	var processRole = exports.isMaster ? 'master' : (exports.isWorker ? 'worker' : 'single');

	process.title = '[' + processRole + '] ' + appName + '/' + appVersion + ' (Mithril v' + mithril.version + ', Node.js ' + nodeVersion + ')';

	// set up cluster, if required

	if (exports.isMaster) {
		logger.info('Spawning', numberOfWorkers, 'worker processes.');

		var workersNotReady = numberOfWorkers;
		while (--numberOfWorkers >= 0) {
			worker = createNewWorker();
			worker.once('listening', function () {
				workersNotReady--;
				if (workersNotReady === 0) {
					if (process.argv[2] === 'start' || process.argv[2] === 'restart') {
						daemon.closeStdio();
						daemon.daemonize({}, LOCKFILE, function (err, pid) {
							logger.info('Game started successfully, master PID:', pid);
							cb();
						});
					}
				}
			});
		}
	}
	else {
		cb();
	}
};

