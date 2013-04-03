var cluster = require('cluster'),
    mage = require('./mage'),
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    async = require('async'),
    logger  = mage.core.logger.context('ProcessManager');

var processManager = module.exports = new EventEmitter();
var workerManager;

processManager.isMaster = false;
processManager.isWorker = false;

processManager.getNumWorkers = function () {
	return workerManager ? workerManager.workers.length : null;
};

var WORKER_STARTUP_TIMEOUT = 60 * 1000;

// EPIPE helper for each process: ignore EPIPE errors that occur on stdout/stderr when piping
// output to another process that is closing.

var epipebomb = require('epipebomb');
epipebomb(process.stdout);
epipebomb(process.stderr);


// The master PID is shared to workers on the environment.

processManager.getMasterPid = function () {
	if (cluster.isMaster) {
		return process.pid;
	}

	return parseInt(process.env.MASTER_PID, 10);
};


// A worker goes through these phases:
// * created: the child process has been created ("fork" event)
// * started: the child process is being executed ("online" event)
// probably:
// * ready: the child process is now accepting requests ("listening" event)
// finally:
// * shutdown: the child process is shutting down (on demand)

var PHASE_CREATED = 0;
var PHASE_STARTED = 1;
var PHASE_READY = 2;
var PHASE_SHUTDOWN = 3;


function WorkerManager(initialMax) {
	EventEmitter.call(this);

	this.max = initialMax;
	this.maxStartupTime = WORKER_STARTUP_TIMEOUT;
	this.parallelism = 4;

	// worker lists

	this.workers = [];
	this.phases = {};

	// setup phases

	this.setupWorkerPhaseManagement();
	this.setupReviver(); // will respawn processes if they died without known cause
}


util.inherits(WorkerManager, EventEmitter);


WorkerManager.prototype.setWorkerPhase = function (worker, phase) {
	this.phases[worker.id] = phase;

	this.emit('phase', worker, phase);
};


WorkerManager.prototype.setupWorkerPhaseManagement = function () {
	// list management and phase logging

	var that = this;
	var workers = this.workers;
	var timers = {};
	var maxStartupTime = this.maxStartupTime;

	function dropStartupTimeout(id) {
		clearTimeout(timers[id]);
		delete timers[id];
	}

	function createStartupTimeout(worker) {
		timers[worker.id] = setTimeout(function () {
			logger.alert('Worker', worker.process.pid, 'took more than', maxStartupTime / 1000, 'sec to startup, shutting down...');

			dropStartupTimeout(worker.id);

			that.killWorker(worker, true);
		}, maxStartupTime);
	}

	cluster.on('fork', function (worker) {
		logger.verbose('Worker', worker.process.pid, 'has been created.');

		that.setWorkerPhase(worker, PHASE_CREATED);
		workers.push(worker);

		createStartupTimeout(worker);
	});

	cluster.on('online', function (worker) {
		logger.verbose('Worker', worker.process.pid, 'has started.');

		that.setWorkerPhase(worker, PHASE_STARTED);
	});

	cluster.on('listening', function (worker, address) {
		logger.verbose.data(address).log('Worker', worker.process.pid, 'is ready to accept requests.');

		that.setWorkerPhase(worker, PHASE_READY);

		dropStartupTimeout(worker.id);
	});

	cluster.on('disconnect', function (worker) {
		logger.verbose.log('Worker', worker.process.pid, 'is shutting down.');

		that.setWorkerPhase(worker, PHASE_SHUTDOWN);
	});

	cluster.on('exit', function (worker) {
		if (worker._mageManagedExit) {
			logger.verbose('Worker', worker.process.pid, 'committed graceful suicide.');
		} else {
			logger.alert('Worker', worker.process.pid, 'died unexpectedly!');
		}

		dropStartupTimeout(worker.id);

		var index = workers.indexOf(worker);
		if (index !== -1) {
			workers.splice(index, 1);
		}

		that.emit('exit', worker, that.phases[worker.id]);

		delete that.phases[worker.id];
	});
};


WorkerManager.prototype.setupReviver = function () {
	var that = this;

	cluster.on('exit', function (worker) {
		// check if the worker was supposed to die

		if (!worker._mageManagedExit) {
			// this exit was not supposed to happen!
			// spawn a new worker to replace the dead one

			processManager.emit('workerOffline', worker.id);
			that.createWorker();
		} else {
			if (!that.workers.length) {
				logger.emergency('All workers have shut down, shutting down master now.');
				that.shutdown();
			}
		}
	});
};


WorkerManager.prototype.createWorker = function (cb) {
	// cb is called exactly once: when the worker starts listening, or when listening failed

	var worker, success, failure;

	success = function (address) {
		worker.removeListener('exit', failure);
		worker._mageManagedExit = false;

		if (cb) {
			cb(null, worker, address);
		}
	};

	failure = function () {
		worker.removeListener('listening', success);
		logger.alert('Worker ' + worker.process.pid + ' exited prematurely.');

		if (cb) {
			cb();
		}
	};

	worker = cluster.fork({ MASTER_PID: process.pid, CLUSTER_START_TIME: processManager.startTime });
	worker._mageManagedExit = true;

	worker.once('listening', success);
	worker.once('exit', failure);
};


WorkerManager.prototype.killWorker = function (worker, graceful, cb) {
	if (!worker) {
		return cb && cb();
	}

	// make sure we kill the process if we fail to

	var shutdownGracePeriod = graceful ? mage.core.config.get('server.shutdownGracePeriod', 15) : 2;

	var timer = setTimeout(function () {
		logger.error('Failed to gracefully stop worker', worker.process.pid, 'after', shutdownGracePeriod, 'seconds. Killing it with SIGKILL (-9)...');

		process.kill(worker.process.pid, 'SIGKILL');
	}, shutdownGracePeriod * 1000);


	worker.once('exit', function () {
		if (timer) {
			clearTimeout(timer);

			if (cb) {
				cb();
			}
		}
	});

	worker._mageManagedExit = true;

	process.kill(worker.process.pid, 'SIGTERM');
};


WorkerManager.prototype.killWorkers = function (workers, graceful, cb) {
	var that = this;

	async.forEach(
		workers.slice(),
		function (worker, callback) {
			that.killWorker(worker, graceful, callback);
		},
		cb
	);
};


WorkerManager.prototype.getWorkersOfPhase = function (phase) {
	var phases = this.phases;

	return this.workers.filter(function (worker) {
		return phases[worker.id] === phase;
	});
};


// setMax will terminate workers if there are more than the new max, but it will not
// spawn workers to conform.

WorkerManager.prototype.setMax = function (max, cb) {
	this.max = max;

	// see if we are running too many workers

	var workers = this.getWorkersOfPhase(PHASE_READY);
	var tooMany = workers.length - this.max;

	if (tooMany > 0) {
		// kill the tooMany workers so we reach max
		// call cb when done

		this.killWorkers(workers.slice(0, tooMany), true, cb);
	} else {
		cb();
	}
};


WorkerManager.prototype.shutdown = function (graceful, cb) {
	logger.verbose('Asking all workers to shut down.');

	this.killWorkers(this.workers, graceful, function () {
		if (graceful) {
			logger.notice('Graceful shutdown complete.');
		} else {
			logger.notice('Non-graceful shutdown complete.');
		}

		// close all net-servers

		cluster.disconnect();

		if (cb) {
			cb();
		}
	});
};


WorkerManager.prototype.recycle = function (cb) {
	var killList = this.workers.slice().reverse(); // we'll pop, so this way the oldest worker comes first
	var spawnCount = this.max;
	var spawned = 0;
	var that = this;
	var progress = [0, spawnCount + killList.length];

	function incProgress() {
		progress[0] += 1;

		processManager.emit('recycleProgress', progress[0], progress[1]);
	}

	function createWorker(callback) {
		spawned += 1;

		that.createWorker(function (error) {
			if (!error) {
				incProgress();
			}

			callback(error);
		});
	}

	function killWorker(callback) {
		that.killWorker(killList.pop(), true, function (error) {
			if (!error) {
				incProgress();
			}

			callback(error);
		});
	}

	function recycler(recyclerCallback) {
		var lastOperation = 'kill'; // 'kill', so that the first operation becomes spawn

		async.whilst(
			function test() {
				return killList.length > 0 || spawned < spawnCount;
			},
			function spawnOrKill(callback) {
				if (lastOperation === 'kill' && spawned < spawnCount) {
					// spawn a new worker

					lastOperation = 'spawn';
					createWorker(callback);
				} else {
					// kill an old worker

					lastOperation = 'kill';

					if (killList.length > 0) {
						killWorker(callback);
					} else {
						callback();
					}
				}
			},
			recyclerCallback
		);
	}

	// create recycle workers for parallel execution

	if (this.parallelism > 1) {
		var recycleWorkers = [];

		for (var i = 0; i < this.parallelism; i++) {
			recycleWorkers.push(recycler);
		}

		async.parallel(recycleWorkers, cb);
	} else {
		recycler(cb);
	}
};


if (cluster.isMaster) {
	process.once('SIGINT', function () {
		logger.verbose('Caught SIGINT, shutting down gracefully.');
		mage.quit(true);
	});

	process.once('SIGTERM', function () {
		logger.verbose('Caught SIGTERM, shutting down gracefully.');
		mage.quit(true);
	});

	process.on('SIGCONT', function () {
		logger.info('Status request received, we are up and running!');
	});
} else {
	// Disable SIGINT handler, since a CTRL-C should only be caught by the master.

	process.on('SIGINT', function () {});

	// Listen for shutdown requests.

	process.once('SIGTERM', function () {
		logger.verbose('Worker received shutdown request.');

		mage.quit(true);
	});
}


process.on('uncaughtException', function (error) {
	logger.emergency('Uncaught exception:', error);
	mage.quit(false, -1);
});

process.on('exit', function () {
	logger.info('Terminated.');
});


processManager.setup = function () {
	// if server.cluster is falsy, it's a standalone app (default).

	var numberOfWorkers = mage.core.config.get('server.cluster', 0);

	// numberOfWorkers === true means we auto-detect the number of cores in the system and
	// spawn as many workers

	if (numberOfWorkers === true) {
		numberOfWorkers = require('os').cpus().length;
	}

	// check if we are in cluster mode or standalone

	if (numberOfWorkers && numberOfWorkers > 0) {
		if (cluster.isMaster) {
			// for the master, we create a WorkerManager

			processManager.isMaster = true;
			processManager.startTime = Date.now();

			workerManager = new WorkerManager(numberOfWorkers);
		} else {
			processManager.isWorker = true;
			processManager.startTime = parseInt(process.env.CLUSTER_START_TIME, 10);
		}
	}

	// set the process' title

	var appName = mage.rootPackage.name;
	var appVersion = mage.rootPackage.version;

	var processRole = processManager.isMaster ? 'master' : (processManager.isWorker ? 'worker' : 'single');

	process.title = '[' + processRole + '] ' + appName + '/' + appVersion + ' (MAGE v' + mage.version + ', Node.js ' + process.version + ')';
};


processManager.start = function (cb) {
	// set up cluster, if required

	if (processManager.isMaster) {
		// spawn the workers

		workerManager.recycle(function () {
			processManager.emit('started');
			cb();
		});
	} else {
		processManager.emit('started');
		cb();
	}
};


processManager.reload = function (cb) {
	if (workerManager) {
		workerManager.recycle(cb);
	} else {
		cb(new Error('Can only reload master processes'));
	}
};


processManager.quit = function (graceful, cb) {
	logger.verbose('Process preparing to shut down (graceful: ' + (graceful ? 'yes' : 'no') + ').');

	if (workerManager) {
		workerManager.shutdown(graceful, cb);
	} else {
		// nothing special to do here for workers, it's the mage object that does the final
		// process.exit()

		cb();
	}
};
