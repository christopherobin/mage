var async = require('async');
var pathJoin = require('path').join;
var spawn = require('child_process').spawn;


/**
 * Installs all components into ./components for all apps that are registered
 *
 * @param {Mage} mage
 * @param {Function} cb
 */

module.exports = function (mage) {
	var logger = mage.core.logger.context('install-components');

	var installer = pathJoin(mage.magePackage.path, 'node_modules', '.bin', 'component-install');
	var targetPath = pathJoin(process.cwd(), 'components');

	function install(path, cb) {
		logger.debug(installer, '-out', targetPath, '(from: ' + path + ')');

		var child = spawn(installer, ['--out', targetPath], { cwd: path, stdio: 'inherit' });
		child.once('exit', function (code) {
			if (code) {
				logger.alert('Installer failed to install', path, '(code: ' + code + ')');
			}

			cb();
		});
	}

	// get all apps

	var apps = mage.core.app.getAppList();

	// for each build target that has a component.json file (indexPages, registered components or mage pages alike):

	var allPaths = [];

	async.forEachSeries(
		apps,
		function (app, callback) {
			var paths = app.getComponentCandidatePaths();

			allPaths = allPaths.concat(paths);

			async.forEachSeries(paths, install, callback);
		},
		function () {
			logger.notice.data(allPaths).log('Installed from', allPaths.length, 'build targets');

			mage.quit();
		}
	);
};
