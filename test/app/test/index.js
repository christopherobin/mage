var async = require('async');
var fs = require('fs');

var Bomb = require('./bomb');
var integration = require('./integration');

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
	project.mage.on('shutdown', after);

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

	function projectIntegration(cb) {
		var stepName = 'integration';

		bomb.arm(stepName);

		// backwards compatibility
		var httpServer = project.mage.core.httpServer || project.mage.core.msgServer.getHttpServer();
		var address = httpServer.server.address();

		integration(address, function (error) {
			if (error) {
				return cb(error);
			}

			bomb.disarm(stepName);

			cb();
		});
	}

	async.series([
		projectSetup,
		projectStart,
		projectIntegration
	], function (error) {
		if (error) {
			console.error(error);
		}

		var exitCode = error ? 1 : 0;

		exit(exitCode);
	});
};