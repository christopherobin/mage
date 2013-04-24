var mage = require('../../mage');
var async = require('async');
var fs = require('fs');
var pathBasename = require('path').basename;
var logger = mage.core.logger.context('gm');

var registeredToolPages = {};


exports.createTool = function (appName, cb) {
	// Get the Tool app

	var toolApp = mage.core.app.get(appName);

	if (!toolApp) {
		// this tool is not exposed, so there is nothing to do
		return cb();
	}


	registeredToolPages[appName] = [];

	function addModuleToolAssets(assetsPath, callback) {
		fs.stat(assetsPath, function (error, stats) {
			if (!error && stats.isDirectory()) {
				toolApp.assetMap.addFolder(assetsPath);
			}

			callback();
		});
	}


	function addPage(fullPath, options) {
		var name = pathBasename(fullPath);

		if (toolApp.getPage(name)) {
			// already added, nothing to do
			return;
		}

		var pageInfo;

		try {
			pageInfo = require(fullPath + '/page.json');
		} catch (err) {
			logger.warning(err);
			return;
		}

		if (Array.isArray(pageInfo.apps) && pageInfo.apps.indexOf(appName) !== -1) {
			// add the page to the list

			toolApp.addPage(name, fullPath, options);

			if (!pageInfo.hasOwnProperty('listed') || pageInfo.listed) {
				registeredToolPages[appName].push({ name: name, fullName: pageInfo.name });
			}

			logger.verbose('Added tool page:', name);
		}
	}


	// Configure its assetmap

	toolApp.assetMap.setup();

	// Set up a loader (login screen)
	// And add login and home, since they come first

	toolApp.setIndexPage(__dirname + '/tool/loader');
	addPage(__dirname + '/tool/pages/login', { assetMap: true });
	addPage(__dirname + '/tool/pages/home');


	var modules = mage.listModules();

	async.forEachSeries(
		modules,
		function (modName, callback) {
			var mod = mage.core.modules[modName];

			if (!mod) {
				var error = new Error('Module "' + modName + '" not found while trying to create a tool for it.');

				return callback(error);
			}

			var modPath = mage.getModulePath(modName);
			var assetsPath = modPath + '/tool/assets';
			var pagesPath = modPath + '/tool/pages';

			addModuleToolAssets(assetsPath, function () {
				fs.readdir(pagesPath, function (error, files) {
					if (error) {
						// it's not an error if the pagesPath does not exist
						return callback();
					}

					for (var i = 0; i < files.length; i++) {
						addPage(pagesPath + '/' + files[i]);
					}

					callback();
				});
			});
		},
		function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, toolApp);
		}
	);
};


exports.getPages = function (appName) {
	return registeredToolPages[appName] || [];
};
