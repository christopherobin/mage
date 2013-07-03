var mage = require('../../mage');
var async = require('async');
var fs = require('fs');
var pathJoin = require('path').join;
var logger = mage.core.logger.context('dashboard');

var registeredToolPages = {};


exports.createDashboard = function (appName, cb) {
	// Get the dashboard app

	var app = mage.core.app.get(appName);
	var loader = null;

	if (!app) {
		// this app is not exposed, so there is nothing to do
		return cb();
	}


	registeredToolPages[appName] = [];

	function addModuleToolAssets(assetsPath, callback) {
		fs.stat(assetsPath, function (error, stats) {
			if (!error && stats.isDirectory()) {
				app.assetMap.addFolder(assetsPath);
			}

			callback();
		});
	}


	function addPage(page) {
		loader.registerComponent(page.fileName, page.fullPath);

		if (!page.info.hasOwnProperty('listed') || page.info.listed) {
			registeredToolPages[appName].push({ name: page.fileName, fullName: page.info.name });
		}

		logger.verbose('Added dashboard page:', page.fileName);
	}


	function addPages(pagesPath, callback) {
		fs.readdir(pagesPath, function (error, files) {
			if (error) {
				// it's not an error if the pagesPath does not exist
				return callback();
			}

			// turn a list of files into a list of required pages

			var i, fileName, fullPath, info, pages = [];

			for (i = 0; i < files.length; i++) {
				fileName = files[i];
				fullPath = pathJoin(pagesPath, fileName);

				if (!app.getComponent(fullPath)) {
					// this page was not yet added

					try {
						info = require(pathJoin(fullPath, 'page.json'));
					} catch (err) {
						logger.warning(err);
						continue;
					}

					if (Array.isArray(info.apps) && info.apps.indexOf(appName) !== -1) {
						pages.push({
							fileName: fileName,
							fullPath: fullPath,
							info: info,
							orderId: info.hasOwnProperty('orderId') ? info.orderId : Infinity
						});
					}
				}
			}

			// sort all pages by orderId (if given) or name

			pages.sort(function (a, b) {
				if (b.orderId === a.orderId) {
					return a.fileName < b.fileName ? -1 : 1;
				}

				return a.orderId - b.orderId;
			});

			pages.forEach(addPage);

			callback();
		});
	}


	// Configure its assetmap

	app.assetMap.setup({ baseUrl: {} });

	// Set up a loader (login screen)
	// And add login and home, since they come first

	loader = app.addIndexPage('loader', pathJoin(__dirname, 'dashboard/dashboardLoader'));
	loader.registerComponent('login', pathJoin(__dirname, 'dashboard/pages/login'), { assetMap: true });

	// List all modules that may expose pages

	var modules = mage.listModules();

	// Move the "dashboard" module to the top, so its Home (etc) pages come first.

	var index = modules.indexOf('dashboard');
	if (index !== -1) {
		modules.splice(index, 1);
	}

	modules.unshift('dashboard');

	// For each module, try to add its dashboard assets and pages to the app.

	async.forEachSeries(
		modules,
		function (modName, callback) {
			var mod = mage.core.modules[modName];

			if (!mod) {
				var error = new Error('Module "' + modName + '" not found while trying to expose it on the dashboard.');

				return callback(error);
			}

			var modPath = mage.getModulePath(modName);
			var assetsPath = pathJoin(modPath, 'dashboard/assets');
			var pagesPath = pathJoin(modPath, 'dashboard/pages');

			addModuleToolAssets(assetsPath, function () {
				addPages(pagesPath, callback);
			});
		},
		cb
	);
};


exports.getPages = function (appName) {
	return registeredToolPages[appName] || [];
};
