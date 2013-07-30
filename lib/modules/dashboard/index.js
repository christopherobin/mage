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
		if (!app.assetMap) {
			return callback();
		}

		fs.stat(assetsPath, function (error, stats) {
			if (!error && stats.isDirectory()) {
				app.assetMap.addFolder(assetsPath);
			}

			callback();
		});
	}


	function addPage(page) {
		loader.registerComponent(page.fileName, page.fullPath);

		if (!page.hasOwnProperty('listed') || page.listed) {
			registeredToolPages[appName].push({
				name: page.fileName,
				fullName: page.name
			});
		}

		logger.verbose('Added dashboard page:', page.fileName);
	}


	function addPages(modName, pagesPath) {
		var pages = mage.core.config.get(['module', modName, 'dashboard', 'pages']);
		if (!pages) {
			return;
		}

		var pageList = [];

		for (var fileName in pages) {
			if (!pages.hasOwnProperty(fileName)) {
				continue;
			}

			var page = pages[fileName];
			var fullPath = pathJoin(pagesPath, fileName);

			// don't reregister a page

			if (app.getComponent(fullPath)) {
				continue;
			}

			// filter on possibly configured apps

			if (Array.isArray(page.apps) && page.apps.indexOf(appName) === -1) {
				continue;
			}

			page.fileName = fileName;
			page.fullPath = fullPath;

			if (!page.hasOwnProperty('orderId')) {
				page.orderId = Infinity;
			}

			pageList.push(page);
		}

		// sort all pages by orderId (if given) or name

		pageList.sort(function (a, b) {
			if (b.orderId === a.orderId) {
				return a.fileName < b.fileName ? -1 : 1;
			}

			return a.orderId - b.orderId;
		});

		pageList.forEach(addPage);
	}


	// Configure its assetmap

	if (app.assetMap) {
		app.assetMap.setup({ baseUrl: {} });
	}

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
				addPages(modName, pagesPath);
				callback();
			});
		},
		cb
	);
};


exports.getPages = function (appName) {
	return registeredToolPages[appName] || [];
};
