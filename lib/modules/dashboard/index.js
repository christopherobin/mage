var mage = require('../../mage');
var async = require('async');
var fs = require('fs');
var pathBasename = require('path').basename;
var pathJoin = require('path').join;
var logger = mage.core.logger.context('dashboard');

var registeredToolPages = {};


exports.createDashboard = function (appName, cb) {
	// Get the dashboard app

	var app = mage.core.app.get(appName);

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


	function addPage(fullPath, options) {
		var name = pathBasename(fullPath);

		if (app.getPage(name)) {
			// already added, nothing to do
			return;
		}

		var pageInfo;

		try {
			pageInfo = require(pathJoin(fullPath, 'page.json'));
		} catch (err) {
			logger.warning(err);
			return;
		}

		if (Array.isArray(pageInfo.apps) && pageInfo.apps.indexOf(appName) !== -1) {
			// add the page to the list

			app.addPage(name, fullPath, options);

			if (!pageInfo.hasOwnProperty('listed') || pageInfo.listed) {
				registeredToolPages[appName].push({ name: name, fullName: pageInfo.name });
			}

			logger.verbose('Added dashboard page:', name);
		}
	}


	function addPages(pagesPath, callback) {
		fs.readdir(pagesPath, function (error, files) {
			if (error) {
				// it's not an error if the pagesPath does not exist
				return callback();
			}

			for (var i = 0; i < files.length; i++) {
				addPage(pathJoin(pagesPath, files[i]));
			}

			callback();
		});
	}


	// Configure its assetmap

	app.assetMap.setup({ baseUrl: {} });

	// Set up a loader (login screen)
	// And add login and home, since they come first

	app.setIndexPage(pathJoin(__dirname, 'dashboard/loader'));
	addPage(pathJoin(__dirname, 'dashboard/pages/login'), { assetMap: true });
	addPage(pathJoin(__dirname, 'dashboard/pages/home'));

	// For each module, try to add its dashboard assets and pages to the app

	var modules = mage.listModules();

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
