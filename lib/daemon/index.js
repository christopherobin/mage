// Command manager for daemonization

require('colours');

var fs = require('fs');
var cluster = require('cluster');
var interrupt = require('./interrupt');

var APP_LOCK_FILE = './.pidfile';
var CMD_LOCK_FILE = './.commandpidfile';


function out(str) {
	process.stdout.write(str + '\n');
}

function err(str) {
	process.stderr.write(str + '\n');
}


// signals from commander to master:

var CMD_QUIT = 'SIGTERM';       // please shutdown
var CMD_RELOAD = 'SIGUSR2';     // please reload

// signal responses from master to commander:

var RESP_PROGRESS = 'SIGCONT';  // notification of progress (need more time, be patient please)
var RESP_SUCCESS = 'SIGCHLD';   // child completed to execute the request
var RESP_FAILED = 'SIGUSR2';    // error response, child failed to execute the request

// exit codes:

var EXIT_SUCCESS = 0; // All is well
var EXIT_FAILED = 1;  // Command failed to execute
var EXIT_TIMEOUT = 2; // No response from MAGE
var EXIT_LOCKED = 3;  // The daemonizer is already doing an operation

// status reports:

var STATUS_RUNNING = 0;
var STATUS_NOTRUNNING = 1;
var STATUS_DISAPPEARED = 2;


// PID file handling

function getFilePid(filename) {
	try {
		return parseInt(fs.readFileSync(filename), 10);
	} catch (e) {
		return null;
	}
}

function setFilePid(filename) {
	var pid = getFilePid(filename);

	function write() {
		fs.writeFileSync(filename, process.pid);
		return true;
	}

	if (!pid) {
		return write();
	}

	// Test if a process with that PID exists. If it doesn't, we can overwrite.
	// Else we bail out in error.

	try {
		// if there is no process with the given PID, process.kill() will throw

		process.kill(pid, 0);
	} catch (error) {
		out('Found PID file: ' + pid + ', but process is gone (continuing)');
		return write();
	}

	return false;
}

function destroyFilePid(filename) {
	try {
		fs.unlinkSync(filename);
		return true;
	} catch (e) {
		return false;
	}
}


function App(runstate, pid) {
	this.runstate = runstate;
	this.pid = pid;
}


function sendSignal(pid, signal, timeoutMsec, cb) {
	var timeout, sigSuccessHandler, sigProgressHandler, sigFailedHandler;

	function done(exitCode) {
		// cleanup

		clearTimeout(timeout);
		process.removeListener(RESP_SUCCESS, sigSuccessHandler);
		process.removeListener(RESP_PROGRESS, sigProgressHandler);
		process.removeListener(RESP_FAILED, sigFailedHandler);

		// return the exit code

		setImmediate(function () {
			cb(exitCode);
		});
	}

	function createTimer() {
		return setTimeout(function () {
			err('Timed out.'.yellow.bold);
			done(EXIT_TIMEOUT);
		}, timeoutMsec || 30000);
	}

	// Daemon is in progress and active, need more time
	sigProgressHandler = function () {
		clearTimeout(timeout);
		timeout = createTimer();
	};

	// Daemon is done
	sigSuccessHandler = function () {
		out('Completed succesfully.'.green.bold);
		done(EXIT_SUCCESS);
	};

	// Request failed
	sigFailedHandler = function () {
		err('Failed.'.red.bold);
		done(EXIT_FAILED);
	};

	// start waiting

	timeout = createTimer();

	process.on(RESP_PROGRESS, sigProgressHandler);
	process.on(RESP_SUCCESS, sigSuccessHandler);
	process.on(RESP_FAILED, sigFailedHandler);

	if (pid && signal) {
		try {
			process.kill(pid, signal);
		} catch (e) {
			err(('Process has gone away').yellow.bold);
			done(EXIT_FAILED);
		}
	}
}


function start(app, cb) {
	// Check if already started
	if (app.runstate === STATUS_RUNNING) {
		out(('Already running (pid: ' + app.pid + ')').green.bold);
		return cb(EXIT_SUCCESS);
	}

	var appName = process.argv[0];

	// copy the args, but remove the "start" or "restart" command

	var args = process.argv.slice(1).filter(function (arg) {
		return arg !== 'start' && arg !== 'restart' && arg !== 'reload';
	});

	// spawn the process

	var spawn = require('child_process').spawn;

	var child = spawn(process.execPath, args, {
		detached: true,
		stdio: 'ignore'
	});

	// assign the PID to the app

	app.pid = child.pid;

	out(('Starting "' + appName + ' ' + args.join(' ') + '"... (pid: ' + child.pid + ')').green.bold);

	// wait for a signal from the child process before we continue

	sendSignal(null, null, null, function (exitCode) {
		// don't count the spawned app in the reference count of the daemonizer

		child.unref();

		app.runstate = STATUS_RUNNING;

		cb(exitCode);
	});
}


function stop(app, cb) {
	if (app.runstate !== STATUS_RUNNING) {
		out('Process is not running'.green.bold);

		return cb(EXIT_SUCCESS);
	}

	out(('Stopping... (pid: ' + app.pid + ')').green.bold);

	sendSignal(app.pid, CMD_QUIT, null, function (exitCode) {
		// EXIT_FAILED still means the app shut down, but there was an error during shutdown. The
		// app should have logged the error. Because the app has still shut down, we turn will
		// report a shutdown success by returning EXIT_SUCCESS.

		if (exitCode === EXIT_FAILED) {
			err('Application exited in error (check logs)'.yellow.bold);
			exitCode = EXIT_SUCCESS;
		}

		if (exitCode === EXIT_SUCCESS) {
			destroyFilePid(APP_LOCK_FILE);

			app.pid = null;
			app.runstate = STATUS_NOTRUNNING;
		}

		cb(exitCode);
	});
}


function reload(app, cb) {
	if (app.runstate !== STATUS_RUNNING || !app.pid) {
		out('Process is not yet running');
		return start(app, cb);
	}

	out(('Reloading... (pid: ' + app.pid + ')').green.bold);

	sendSignal(app.pid, CMD_RELOAD, null, cb);
}


function status(app, cb) {
	switch (app.runstate) {
	case STATUS_RUNNING:
		out(('Status: Running (pid: ' + app.pid + ')').green.bold);
		break;
	case STATUS_NOTRUNNING:
		err('Status: Not running'.red.bold);
		break;
	case STATUS_DISAPPEARED:
		err(('Status: Process disappeared (pid: ' + app.pid + ')').red.bold);
		break;
	default:
		err(('Status: Undefined (pid: ' + app.pid + ')').red.bold);
		break;
	}

	// use the runstate value as exit-code

	cb(app.runstate);
}


function notifyCommander(signal) {
	var commandPid = getFilePid(CMD_LOCK_FILE);
	if (commandPid) {
		process.kill(commandPid, signal);
	}
}


function loadAppStatus() {
	// load the PID from the PID file

	var pid = getFilePid(APP_LOCK_FILE);

	if (!pid) {
		// The process is considered not to be running, since there is no known PID.

		return new App(STATUS_NOTRUNNING);
	}

	try {
		// If there is no process with the given PID, process.kill() will throw

		process.kill(pid, 0);

		return new App(STATUS_RUNNING, pid);
	} catch (e) {
		// There is no process with this PID, so we can destroy the PID file.

		destroyFilePid(APP_LOCK_FILE);

		return new App(STATUS_DISAPPEARED, pid);
	}
}


// The user is trying to run a daemonizer command. Lock daemon command execution for the duration of
// the process, and return the app's current state from APP_LOCK_FILE.

function lockAndLoad() {
	// lock command execution

	if (!setFilePid(CMD_LOCK_FILE)) {
		err('A command is already running, aborting...'.red.bold);

		process.exit(EXIT_LOCKED);

		// abort the normal code flow

		return interrupt();
	}

	process.once('exit', function () {
		// using "exit" ensures that it gets removed, even if there was an exception

		destroyFilePid(CMD_LOCK_FILE);
	});

	return loadAppStatus();
}


function exit(code) {
	process.exit(code || 0);
}


exports.start = function () {
	var app = lockAndLoad();

	start(app, exit);

	interrupt();
};


exports.stop = function () {
	var app = lockAndLoad();

	stop(app, exit);

	interrupt();
};


exports.restart = function () {
	var app = lockAndLoad();

	stop(app, function (code) {
		if (code === EXIT_SUCCESS) {
			start(app, exit);
		} else {
			exit(code);
		}
	});

	interrupt();
};


exports.reload = function () {
	var app = lockAndLoad();

	reload(app, exit);

	interrupt();
};


exports.status = function () {
	var app = lockAndLoad();

	status(app, exit);

	interrupt();
};


// This is where MAGE really starts
// We set up some critical event listeners on the master process, so that we signal back to
// daemonizer processes to report the status of their requests.

exports.appMaster = function () {
	// only the master of a cluster communicates with the daemon commander

	if (!cluster.isMaster) {
		return;
	}

	// lock the app (PID file)

	if (!setFilePid(APP_LOCK_FILE)) {
		err('This application is already running, aborting...'.red.bold);

		process.exit(EXIT_LOCKED);

		// abort the normal code flow

		return interrupt();
	}

	// listen for workers being spawned

	var processManager = require('../processManager');

	processManager.once('started', function () {
		notifyCommander(RESP_SUCCESS);
	});

	// when the app shuts down, unlock the app (PID file)

	process.once('exit', function (exitCode) {
		destroyFilePid(APP_LOCK_FILE);
		notifyCommander(exitCode === 0 ? RESP_SUCCESS : RESP_FAILED);
	});

	// when being asked to reload (recycle workers), let the processManager know

	process.on(CMD_RELOAD, function () {
		function progress(step, total) {
			if (step < total) {
				notifyCommander(RESP_PROGRESS);
			}
		}

		processManager.on('recycleProgress', progress);

		processManager.reload(function (error) {
			notifyCommander(error ? RESP_FAILED : RESP_SUCCESS);

			processManager.removeListener('recycleProgress', progress);
		});
	});
};
