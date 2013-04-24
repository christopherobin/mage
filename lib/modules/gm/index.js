var mage = require('../../mage');
var async = require('async');
//var crypto = require('crypto');
var fs = require('fs');
var logger = mage.core.logger.context('gm');

var registeredToolPages = [];
var config;


exports.createTools = function (cb) {
	registeredToolPages = [];
	config = mage.core.config.get('module.gm');

	// Get the Tool app

	var toolApp = mage.core.app.get('tool');

	// Configure its assetmap

	toolApp.assetMap.setup();

	// Set up a loader (login screen)

	toolApp.setIndexPage(__dirname + '/tool/loader');


	function addModuleToolAssets(assetsPath, callback) {
		fs.stat(assetsPath, function (error, stats) {
			if (!error && stats.isDirectory()) {
				toolApp.assetMap.addFolder(assetsPath);
			}

			callback();
		});
	}


	function listModuleToolPages(pagesPath, callback) {
		var pages = [];

		fs.readdir(pagesPath, function (error, files) {
			if (error) {
				// errors are not fatal

				return callback(null, pages);
			}

			async.forEachSeries(
				files,
				function (fileName, callback) {
					var fullPath = pagesPath + '/' + fileName;

					fs.stat(fullPath, function (error, stats) {
						if (error) {
							return callback();
						}

						if (stats.isDirectory()) {
							pages.push({ name: fileName, fullPath: fullPath });
						}

						callback();
					});
				},
				function () {
					callback(null, pages);
				}
			);
		});
	}


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
				listModuleToolPages(pagesPath, function (noerror, pages) {
					for (var i = 0; i < pages.length; i++) {
						var page = pages[i];

						if (modName === 'gm' && page.name === 'login') {
							toolApp.addPage(page.name, page.fullPath, { assetMap: true });
						} else {
							toolApp.addPage(page.name, page.fullPath);
						}

						registeredToolPages.push(page.name);

						logger.verbose('Added tool page:', page.name);
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


exports.getPages = function () {
	return registeredToolPages;
};
