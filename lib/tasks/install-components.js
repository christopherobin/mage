var async = require('async');
var pathJoin = require('path').join;
var spawn = require('child_process').spawn;
var componentProxy = require('component-proxy-install');


exports.setup = function (mage, options, cb) {
	// Set up the logging system according to config.

	function setupLogging(callback) {
		mage.core.loggingService.setup(callback);
	}

	// Create the apps

	function createApps(callback) {
		mage.core.app.createApps();

		if (mage.dashboard) {
			mage.dashboard.setupDashboardApps(callback);
		} else {
			callback();
		}
	}

	async.series([
		setupLogging,
		createApps
	], function (error) {
		if (error) {
			return cb(error);
		}

		cb(null, { allowUserCallback: true });
	});
};


/**
 * Installs all components into ./components for all apps that are registered
 *
 * @param {Mage} mage
 * @param {Object} options
 * @param {Function} cb
 */

exports.start = function (mage, options, cb) {
	var logger = mage.core.logger.context('install-components');

	componentProxy.start();
	var port = componentProxy.getPort();
	var remoteArgs = [ '-r', 'https://raw.githubusercontent.com,http://127.0.0.1:' + port ];

	var windowsExtension = process.platform === 'win32' ? '.cmd' : '';

	var installer = pathJoin(mage.magePackage.path, 'node_modules', '.bin', 'component-install') + windowsExtension;
	var targetPath = pathJoin(process.cwd(), 'components');

	function install(path, cb) {
		var args = ['--out', targetPath].concat(remoteArgs);

		logger.debug(installer, args.join(' '), '(from: ' + path + ')');

		var child = spawn(installer, args, { cwd: path, stdio: 'inherit' });
		child.once('exit', function (code) {
			if (code) {
				logger.alert('Installer failed to install', path, '(code: ' + code + ')');
				return mage.quit(1);
			}

			cb();
		});
	}

	// get all apps

	var apps = mage.core.app.getAppList();

	if (apps.length === 0) {
		logger.warning('There are no apps set up, so no components to install.');
		return cb(null, { shutdown: true });
	}


	// for each build target that has a component.json file (indexPages, registered components or mage pages alike):

	var paths = [];

	apps.forEach(function (app) {
		paths = paths.concat(app.getComponentCandidatePaths());
	});

	// since apps can share pages, components, etc, there are likely to be duplicate build targets
	// that we can remove

	paths.sort();

	for (var i = 0; i < paths.length - 1; i++) {
		if (paths[i + 1] === paths[i]) {
			paths.splice(i + 1, 1);
			i -= 1;
		}
	}

	// install components from each build target path

	async.forEachSeries(
		paths,
		install,
		function () {
			logger.notice.data(paths).log('Installed from', paths.length, 'build targets');
			componentProxy.stop(function () {
				cb(null, { shutdown: true });
			});
		}
	);
};
