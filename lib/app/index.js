var async = require('async');

var web = require('./web');
var WebApp = web.WebApp;
var mage = require('../mage');
var logger = mage.core.logger;

exports.builders = require('./builders');
exports.contexts = require('./contexts');
exports.web = web;
exports.BuildTarget = require('./buildTarget').BuildTarget;


// register some core builders

require('./corebuilders').register();


// register some core contexts

exports.contexts.add('bin', 'application/octet-stream', '\n').addFileExtensions(['*']);


// app registration

var appMap = {};
var appList = [];


/**
 * This function creates instances of all configured apps and registers them into appMap and appList.
 */

exports.createApps = function () {
	var appsConfig = mage.core.config.get(['apps']);

	for (var appName in appsConfig) {
		if (appsConfig.hasOwnProperty(appName)) {
			var config = appsConfig[appName];

			if (config && !config.disabled) {
				logger.debug('Creating WebApp:', appName);

				var app = new WebApp(appName, config);

				app.getCommandCenter().setup();

				appMap[appName] = app;
				appList.push(app);
			} else {
				logger.debug('Not creating WebApp:', appName, '(no configuration found)');
			}
		}
	}
};


/**
 * Loads and builds apps. This should be a noop in development mode.
 *
 * @param {Function} cb
 */

exports.buildApps = function (cb) {
	async.eachSeries(
		appList,
		function (app, callback) {
			// try to load builds from disk if they happen to exist

			app.loadBuilds(function (error) {
				if (error) {
					return callback(error);
				}

				// create missing builds

				app.makeBuilds(callback);
			});
		},
		cb
	);
};


/**
 * Registers routes for every app on the HTTP server so that their pages can be downloaded
 */

exports.exposeAppsOnClientHost = function () {
	appList.forEach(function (app) {
		app.exposeOnClientHost();
	});
};


/**
 * Returns an app instance by name
 *
 * @param {string} name The name of the app
 * @returns {WebApp}
 */

exports.get = function (name) {
	return appMap[name];
};


/**
 * Returns all app instances in a list
 *
 * @returns {Array} All app instances
 */

exports.getAppList = function () {
	return appList;
};


/**
 * Returns all app instances in a key/value object
 *
 * @returns {Object} All app instances
 */

exports.getAppMap = function () {
	return appMap;
};
