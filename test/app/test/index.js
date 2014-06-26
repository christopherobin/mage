var async = require('async');
var fs = require('fs');

var integration = require('./integration');

var DEFAULT_DURATION = 10000;
var durations = {};

function unlink(path) {
	try {
		fs.unlinkSync(path);
	} catch (e) {

	}
}

function cleanUp() {
	unlink('./node_modules/mage');
	unlink('./node_modules');
}

function before() {
	cleanUp();

	fs.symlinkSync('../../node_modules', './node_modules', 'dir');
	fs.symlinkSync('../../mage', './node_modules/mage', 'dir');
}

exports.before = before;

function after() {
	cleanUp();
}

exports.after = after;

exports.start = function (app) {
	app.mage.on('shutdown', after);

	function exit(exitCode) {
		console.log('Exiting with code:', exitCode);

		cleanUp();

		app.quit(exitCode);

		process.exit(exitCode);
	}

	var bomb = { start: Date.now() };

	function explode(name) {
		name = name || bomb.name;
		console.error(name, 'exploded.');

		exit(1);
	}

	function armBomb(name) {
		clearTimeout(bomb.fuse);

		bomb.duration = durations[name] || DEFAULT_DURATION;
		bomb.name = name;
		bomb.start = Date.now();

		bomb.fuse = setTimeout(explode, bomb.duration);
	}

	function disarmBomb(name) {
		if (bomb.name !== name) {
			return explode(name);
		}

		clearTimeout(bomb.fuse);
		console.log(name, 'completed in', Date.now() - bomb.start, 'msec');
	}

	function appSetup(cb) {
		var stepName = 'setup';

		armBomb(stepName);

		app.setup(function (error, apps) {
			if (error) {
				return cb(error);
			}

			disarmBomb(stepName);

			// setting 'prebuild' to true tells MAGE to build the app during the
			// start phase instead of on every http request.

			for (var appId in apps) {
				apps[appId].prebuild = true;
			}

			cb();
		});
	}

	function appStart(cb) {
		var stepName = 'start';

		armBomb(stepName);

		app.start(function (error) {
			if (error) {
				return cb(error);
			}

			disarmBomb(stepName);

			cb();
		});
	}

	function appIntegration(cb) {
		var stepName = 'integration';

		armBomb(stepName);

		var address = app.mage.core.msgServer.getHttpServer().server.address();

		integration(address, function (error) {
			if (error) {
				return cb(error);
			}

			disarmBomb(stepName);

			cb();
		});
	}

	async.series([
		appSetup,
		appStart,
		appIntegration
	], function (error) {
		var exitCode = error ? 1 : 0;

		exit(exitCode);
	});
};
