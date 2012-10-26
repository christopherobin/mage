// Command manager for daemonization
var fs = require('fs'),
    colors = require('colors'),
    cp = require('child_process');

var DAEMON_LOCK_FILE = './.pidfile';
var COMMAND_LOCK_FILE = './.commandpidfile';

var setFilePid = function (filename) {
    fs.writeFileSync(filename, process.pid);
};

var getFilePid = function (filename) {
	try {
		return parseInt(fs.readFileSync(filename), 10);
	}
	catch (e) {
		return null;
	}
};

var destroyFilePid = function (filename) {
    try {
        fs.unlinkSync(filename);
        return true;
    }
    catch (e) {
        return false;
    }
};

var daemonRunningStatus = function (pid) {

	var currentPid, testPid;

	if (!currentPid && !pid) {
		currentPid = getFilePid(DAEMON_LOCK_FILE);

        if (!currentPid) {
			return [-1, null];
		}
	}

	testPid = pid ? pid : currentPid;

	try {
		process.kill(testPid, 'SIGCONT');
		return [0, testPid];
	} catch (e) {
		return [-2, testPid];
	}
};

var waitForConfirmation = function (cb, time) {
    var timeoutFactory = function () {
        return setTimeout(function () {
            cb(null);
        }, time || 15000);
    };

    var timeout = timeoutFactory();

    // Daemon is done
    process.once('SIGHUP', function () {
        clearTimeout(timeout);
        cb(false);
    });

    // Daemon is in procgress and active, need more time
    process.on('SIGCONT', function () {
        clearTimeout(timeout);
        timeout = timeoutFactory();
    });

    process.on('SIGUSR2', function () {
        clearTimeout(timeout);
        cb(true);
    });
};

var start = function (called, cb) {

    console.log('Starting...'.green.bold);

    var app = cp.fork(called, null, {
        detached: true,
        stdio: [ 'ignore', 'ignore', 'ignore' ]
    });

    waitForConfirmation(function (err) {
        if (err === null) {
            console.warn('Start operation timed out'.yellow.timeout);
        }
        else if (err === true) {
            console.error('Start operation failed'.red.bold);
        }
        else {
            console.log('Start operation completed normally'.green.bold);
        }

        app.unref();

        cb(err);
    });
};

var stop = function (daemonStatus, daemonPid, cb) {
    if (daemonStatus < 0) {
        console.warn('Process is not running...'.yellow.bold);
        destroyFilePid(DAEMON_LOCK_FILE);
        return cb(false);
    }

    console.log('Stopping...'.green.bold);

    try {
        process.kill(daemonPid, 'SIGTERM');
    }
    catch (e) {
        console.warn('Stop operation failed, Mithril has already gone away'.yellow.bold);
        return cb(false);
    }

    waitForConfirmation(function (err) {

        if (err === null) {
            console.warn('Stop operation timed out'.yellow.bold);
        }
        else if (err === true) {
            console.error('Stop operation failed'.red.bold);
            destroyFilePid(DAEMON_LOCK_FILE);
        }
        else {
            console.log('Stop operation completed normally'.green.bold);
            destroyFilePid(DAEMON_LOCK_FILE);
        }

        cb(err);
    });
};

var reload = function (daemonStatus, daemonPid, cb) {
    if (daemonStatus < 0) {
        console.error('Could not reload, process is not running'.red.bold);
        destroyFilePid(DAEMON_LOCK_FILE);
        return cb(false);
    }

    console.log('Reloading...'.green.bold);

    try {
        process.kill(daemonPid, 'SIGUSR2');
    }
    catch (e) {
        console.error('Reload operation failed, Mithril has gone away'.red.bold);
        return cb(false);
    }

    waitForConfirmation(function (err) {
        if (err === null) {
            console.warn('Reload operation timed out.'.yellow.bold);
        }
        else if (err === true) {
            console.error('Reload operation failed.'.red.bold);
        }
        else {
            console.log('Process reload completed normally'.green.bold);
        }

        cb(err);
    });
};

var run = function (called, command, cb) {

    var daemonInfo = daemonRunningStatus();
    var daemonStatus = daemonInfo[0];
    var daemonPid = daemonInfo[1];

    switch (command) {

    // Here, we start either in daemon mode or inline
    // In both case, we check if we have a pid file
    case undefined:
    case 'start':
        if (daemonPid > 0) {
            console.warn(('Already running (pid:' + daemonPid + '), exiting...').yellow.bold);
            return cb(false);
        }

        start(called, cb);
        break;

        // Restart logic
    case 'restart':
        stop(daemonStatus, daemonPid, function (err) {

            if (err) {
                return cb(err);
            }

            start(called, cb);
        });
        break;

    case 'stop':
        stop(daemonStatus, daemonPid, cb);
        break;

    case 'reload':
        reload(daemonStatus, daemonPid, cb);
        break;

    case 'status':
        switch (daemonStatus) {
        case -1:
            console.error('Status: Not running'.red.bold);
            break;
        case -2:
            console.error(('Status: Dead (pid: ' + daemonPid + ')').red.bold);
            break;
        default:
            console.log(('Status: Running (pid: ' + daemonPid + ')').green.bold);
            break;
        }

        cb(daemonPid > 0 ? 0 : Math.abs(daemonPid));
        break;

    default:
        console.error("           _ _   _          _ _".blue.bold);
        console.error(" _ __ ___ (_) |_| |__  _ __(_) |".blue.bold);
        console.error("| '_ ` _ \\| | __| '_ \\| '__| | |".blue.bold);
        console.error("| | | | | | | |_| | | | |  | | |".blue.bold);
        console.error("|_| |_| |_|_|\\__|_| |_|_|  |_|_|".blue.bold);
        console.error('÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷');
        console.error('Usage (as daemon)       :'.magenta.bold, 'node . [start|stop|restart|reload|status]');
        console.error('Usage (to run in shell) :'.magenta.bold, 'node .');
        console.error('÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷÷');
        cb(false);
        break;
    }
};

var notifyCommander = function (signal) {

    signal = signal || 'SIGHUP';

    var commandPid = getFilePid(COMMAND_LOCK_FILE);
    if (commandPid) {
        process.kill(commandPid, signal);
    }
};

var getSignal = function (retCode) {
    if (retCode < 0) {
        return 'SIGCONT';
    }
    if (retCode > 0) {
        return 'SIGUSR2';
    }

    return 'SIGHUP';
};

// This is where mithril really starts;
exports.unlock = function (retCode) {
    destroyFilePid(DAEMON_LOCK_FILE);
    notifyCommander(getSignal(retCode));
};

exports.lock = function (retCode) {
    setFilePid(DAEMON_LOCK_FILE);
    notifyCommander(getSignal(retCode));
};

exports.start = function () {
    var called  = process.argv[1];
    var command = process.argv[2];

    if (getFilePid(COMMAND_LOCK_FILE)) {
        console.error('A command is already running, exitting...'.red.bold);
        process.exit(3);
    }

    setFilePid(COMMAND_LOCK_FILE);

    run(called, command, function (err) {
        destroyFilePid(COMMAND_LOCK_FILE);

        var retCode = 0;

        if (err === null) {
            retCode = 2;
        }
        if (err === false) {
            retCode = 1;
        }

        process.exit(retCode);
    });
};

exports.isCommander = function () {
    return process.argv.length >= 3;
};

