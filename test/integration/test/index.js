var async = require('async');
var fs = require('fs');

var Bomb = require('./bomb');
var runners = [
	{ name: 'Browser', run: require('./runners/browser') },
	{ name: 'Mocha CLI', run: require('./runners/mocha-cli') },
	{ name: 'Mocha API', run: require('./runners/mocha-embedded') }
];

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

exports.before = before;

function after() {
	cleanUp();
}

exports.after = after;

exports.start = function (project) {
	function exit(exitCode) {
		console.log('Exiting with code:', exitCode);

		cleanUp();

		project.quit(exitCode);

		process.exit(exitCode);
	}

	var bomb = new Bomb();

	bomb.on('exploded', function (name, msec) {
		console.error(name, 'failed after', msec, 'msec');
		exit(1);
	});

	bomb.on('disarmed', function (name, msec) {
		console.log(name, 'completed in', msec, 'msec');
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

	projectSetup(function (error) {
		if (error) {
			console.error(error);
			return exit(1);
		}

		projectStart(function (error) {
			if (error) {
				console.error(error);
				return exit(1);
			}

			if (!project.autorun) {
				console.log('Waiting for requests');
				return;
			}

			// run all the tests

			async.eachSeries(
				runners,
				runTests,
				function (error) {
					if (error) {
						console.log(error.stack || error);
						return exit(1);
					}

					exit(0);
				}
			);
		});
	});
};