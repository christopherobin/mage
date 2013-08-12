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

			mage.quit();
		}
	);
};
