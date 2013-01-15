// Command manager for daemonization

require('colors');

var fs = require('fs'),
    cluster = require('cluster');

var DAEMON_LOCK_FILE = './.pidfile';
var COMMAND_LOCK_FILE = './.commandpidfile';


function out(str) {
	process.stdout.write(str + '\n');
}

function err(str) {
	process.stderr.write(str + '\n');
}


// signals from parent to child:

var CMD_QUIT = 'SIGTERM';       // please shutdown
var CMD_RELOAD = 'SIGUSR2';     // please reload
var CMD_LOGSTATUS = 'SIGCONT';  // please log your status

// signal responses from child to parent:

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


// argv handling

function detectArgs(argv) {
	var args = [];

	for (var i = 2, len = argv.length; i < len; i++) {
		var arg = argv[i];

		// only collect --option and -flag style arguments

		if (arg[0] === '-') {
			args.push(arg);
		}
	}

	return args;
}

function detectDaemonCommand(argv) {
	for (var i = 2, len = argv.length; i < len; i++) {
		var arg = argv[i];

		// ignore --option and -flag style arguments

		if (arg[0] !== '-') {
			return arg;
		}
	}
}


// PID file handling

function setFilePid(filename) {
	fs.writeFileSync(filename, process.pid);
}

function getFilePid(filename) {
	try {
		return parseInt(fs.readFileSync(filename), 10);
	} catch (e) {
		return null;
	}
}

function destroyFilePid(filename) {
	try {
		fs.unlinkSync(filename);
		return true;
	} catch (e) {
		return false;
	}
}


function getDaemonStatus() {
	// load the PID from the PID file

	var pid = getFilePid(DAEMON_LOCK_FILE);

	if (!pid) {
		// the process is considered not to be running, since there is no known PID.

		return [STATUS_NOTRUNNING, null];
	}

	try {
		// if there is no process with the given PID, process.kill() will throw

		process.kill(pid, CMD_LOGSTATUS);

		return [STATUS_RUNNING, pid];
	} catch (e) {
		return [STATUS_DISAPPEARED, pid];
	}
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

		process.nextTick(function () {
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
	process.once(RESP_SUCCESS, sigSuccessHandler);
	process.once(RESP_FAILED, sigFailedHandler);

	if (pid && signal) {
		try {
			process.kill(pid, signal);
		} catch (e) {
			err(('Process has gone away').yellow.bold);
			done(EXIT_FAILED);
		}
	}
}


function Daemon() {
	var info = getDaemonStatus();

	this.runstate = info[0];
	this.pid = info[1];
}


Daemon.prototype.start = function (cb) {
	if (this.pid) {
		err(('Already running (pid: ' + this.pid + '), aborting...').yellow.bold);
		return cb(EXIT_FAILED);
	}

	var appName = process.argv[0];
	var args = detectArgs(process.argv);
	var that = this;

	// prepend the script name to the args list

	args = [process.argv[1]].concat(args);

	// spawn the process

	var cp = require('child_process');

	var child = cp.spawn(appName, args, {
		detached: true,
		stdio: 'ignore'
	});

	this.pid = child.pid;

	out(('Starting "' + appName + ' ' + args.join(' ') + '"... (pid: ' + child.pid + ')').green.bold);

	sendSignal(null, null, null, function (exitCode) {
		// don't count the spawned app in the reference count of the daemonizer

		child.unref();
		that.runstate = STATUS_RUNNING;

		cb(exitCode);
	});
};


Daemon.prototype.stop = function (cb) {
	if (this.runstate !== STATUS_RUNNING || !this.pid) {
		err('Process is not running.'.yellow.bold);
		destroyFilePid(DAEMON_LOCK_FILE);
		return cb(EXIT_FAILED);
	}

	var that = this;

	out(('Stopping... (pid: ' + this.pid + ')').green.bold);

	sendSignal(this.pid, CMD_QUIT, null, function (exitCode) {
		if (exitCode === EXIT_FAILED || exitCode === EXIT_SUCCESS) {
			destroyFilePid(DAEMON_LOCK_FILE);
		}

		that.pid = null;
		that.runstate = STATUS_NOTRUNNING;

		cb(exitCode);
	});
};


Daemon.prototype.restart = function (cb) {
	var that = this;

	this.stop(function (exitCode) {

		if (exitCode === EXIT_SUCCESS) {
			// restart the script

			that.start(cb);
		} else {
			// stop failed, abort

			cb(exitCode);
		}
	});
};


Daemon.prototype.reload = function (cb) {
	if (this.runstate !== STATUS_RUNNING || !this.pid) {
		err('Could not reload, process is not running'.red.bold);
		destroyFilePid(DAEMON_LOCK_FILE);
		return cb(EXIT_FAILED);
	}

	out(('Reloading... (pid: ' + this.pid + ')').green.bold);

	sendSignal(this.pid, CMD_RELOAD, null, cb);
};


Daemon.prototype.status = function (cb) {
	switch (this.runstate) {
	case STATUS_RUNNING:
		out(('Status: Running (pid: ' + this.pid + ')').green.bold);
		break;
	case STATUS_NOTRUNNING:
		err('Status: Not running'.red.bold);
		break;
	case STATUS_DISAPPEARED:
		err(('Status: Process disappeared (pid: ' + this.pid + ')').red.bold);
		break;
	default:
		err(('Status: Undefined (pid: ' + this.pid + ')').red.bold);
		break;
	}

	// use the runstate value as exit-code

	cb(this.runstate);
};


Daemon.prototype.help = function (cb) {
	var baseCommand = process.argv[0] + ' ' + process.argv[1];

	err("           _ _   _          _ _".blue.bold);
	err(" _ __ ___ (_) |_| |__  _ __(_) |".blue.bold);
	err("| '_ ` _ \\| | __| '_ \\| '__| | |".blue.bold);
	err("| | | | | | | |_| | | | |  | | |".blue.bold);
	err("|_| |_| |_|_|\\__|_| |_|_|  |_|_|".blue.bold);
	err('÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷');
	err('Usage (as daemon)       : '.magenta.bold + baseCommand + ' [start|stop|restart|reload|status]');
	err('Usage (to run in shell) : '.magenta.bold + baseCommand);
	err('÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷');
	err('Note: "reload" will recycle all worker processes, but leave the master alive for a zero-');
	err('      downtime restart. This should not be used on a version change.');

	cb(EXIT_FAILED);
};


function runCommand(command, cb) {
	var daemon = new Daemon();

	switch (command) {
	case 'start':
		return daemon.start(cb);

	case 'stop':
		return daemon.stop(cb);

	case 'restart':
		return daemon.restart(cb);

	case 'reload':
		return daemon.reload(cb);

	case 'status':
		return daemon.status(cb);

	default:
		return daemon.help(cb);
	}
}


function notifyCommander(signal) {
	var commandPid = getFilePid(COMMAND_LOCK_FILE);
	if (commandPid) {
		process.kill(commandPid, signal);
	}
}


// This is where MAGE really starts
// We set up some critical event listeners on the master process, so that we signal back to
// daemonizer processes to report the status of their requests.

function normalAppFlow() {
	// only the master of a cluster communicates with the daemon commander

	if (!cluster.isMaster) {
		return;
	}

	// lock the app (PID file)

	setFilePid(DAEMON_LOCK_FILE);

	// listen for workers being spawned

	var processManager = require('./processManager');

	processManager.once('started', function () {
		notifyCommander(RESP_SUCCESS);
	});

	// when the app shuts down, unlock the app (PID file)

	process.once('exit', function (exitCode) {
		destroyFilePid(DAEMON_LOCK_FILE);
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
}


function SilentCodeInterruption() {}


function interrupt() {
	var listeners = process.listeners('uncaughtException');

	function exceptionHandler() {
		// ignore the SilentCodeInterruption and restore the listeners

		for (var i = 0, len = listeners.length; i < len; i++) {
			process.on('uncaughtException', listeners[i]);
		}
	}

	// remove all listeners temporarily

	process.removeAllListeners('uncaughtException');

	// throw and catch the uncaught silent exception, thereby interrupting the code flow

	process.once('uncaughtException', exceptionHandler);

	throw new SilentCodeInterruption();
}


function init() {
	// find a daemonizer command in the argv list

	// guaranteed argv[i] values:
	//   argv[0]: 'something/node'
	//   argv[1]: 'something/thescript.js'

	var command = detectDaemonCommand(process.argv);

	// if no command is found, the app should run as usual

	if (!command) {
		return normalAppFlow();
	}

	// the user is trying to run a daemonizer command

	if (getFilePid(COMMAND_LOCK_FILE)) {
		err('A command is already running, aborting...'.red.bold);

		process.exit(EXIT_LOCKED);

		// abort the normal code flow

		return interrupt();
	}

	// lock command execution

	setFilePid(COMMAND_LOCK_FILE);

	process.once('exit', function () {
		// using "exit" ensures that it gets removed, even if there was an exception

		destroyFilePid(COMMAND_LOCK_FILE);
	});

	// execute the command, and quit the process when we're done

	runCommand(command, function (exitCode) {
		process.exit(exitCode);
	});

	// abort the normal code flow

	interrupt();
}


init();
