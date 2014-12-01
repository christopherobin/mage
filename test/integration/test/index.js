var async = require('async');
var fs = require('fs');
var Bomb = require('itd');

function unlink(path) {
	try {
		fs.unlinkSync(path);
	} catch (e) {
	}
}

function cleanUp() {
	unlink('./components');
	unlink('./node_modules/mage');
	unlink('./node_modules');
}

function before() {
	cleanUp();

	fs.symlinkSync('../../components', './components', 'dir');
	fs.symlinkSync('../../node_modules', './node_modules', 'dir');
	fs.symlinkSync('../', './node_modules/mage', 'dir');
}

function after() {
	cleanUp();
}

exports.before = before;
exports.after = after;


exports.start = function (project) {
	function exit(exitCode) {
		console.log('Exiting with code:', exitCode);

		cleanUp();

		project.quit(exitCode);
	}

	var bomb = new Bomb();

	bomb.on('exploded', function (code, duration, reason) {
		switch (reason) {
		case 'timeOut':
			console.error('Step: ' + code + ' failed to complete in ' + duration + ' msec');
			break;
		case 'wrongCode':
			console.error('Step: ' + code + ' completed while ' + bomb.code + ' was active');
			break;
		case 'alreadyArmed':
			console.error('Step: ' + code + ' started while ' + bomb.code + ' was active');
			break;
		default:
			console.error('Bomb exploded for unknown reason'); // This should never happen.
		}
		exit(1);
	});

	bomb.on('disarmed', function (code, duration) {
		console.log('Step:', code, 'completed in', duration, 'msec');
	});


	function projectSetup(cb) {
		var stepName = 'setup';

		bomb.arm(stepName);

		project.setup(function (error, apps) {
			if (error) {
				return cb(error);
			}

			bomb.disarm(stepName);

			// setting 'prebuild' to true tells MAGE to build the app during the
			// start phase instead of on every http request.

			for (var appId in apps) {
				apps[appId].prebuild = true;
			}

			cb();
		});
	}

	function projectStart(cb) {
		var stepName = 'start';

		bomb.arm(stepName);

		project.start(function (error) {
			if (error) {
				return cb(error);
			}

			bomb.disarm(stepName);

			cb();
		});
	}

	function runTests(runner, cb) {
		bomb.arm(runner.name);

		runner.run(project, function (error) {
			if (error) {
				return cb(error);
			}

			bomb.disarm(runner.name);

			cb();
		});
	}


	// create the project and host it,
	// then wait for requests or run the tests immediately

	async.series([projectSetup, projectStart], function (error) {
		if (error) {
			console.error(error);
			return exit(1);
		}

		var runners = [
			{ name: 'Browser', run: require('./runners/browser') },
			{ name: 'Mocha CLI', run: require('./runners/mocha-cli') },
			{ name: 'Mocha API', run: require('./runners/mocha-embedded') }
		];

		if (project.autorun) {
			runners.push({ name: 'Shutdown', run: require('./runners/shutdown') });
		}

		if (!project.autorun) {
			var httpServer = project.mage.core.httpServer || project.mage.core.msgServer.getHttpServer();
			var address = httpServer.server.address();

			console.log('Waiting for requests at http://' + address.address + ':' + address.port + '/app/test');
			return;
		}

		// run all the tests

		async.eachSeries(runners, runTests, function (error) {
			if (error) {
				console.error(error.stack || error);
				return exit(1);
			}

			exit(0);
		});
	});
};
