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

exports.createApps = function (cb) {
	var appsConfig = mage.core.config.get(['apps']);

	var appNames = Object.keys(appsConfig);

	async.eachLimit(appNames, 5, function (appName, callback) {
		var appConfig = appsConfig[appName];

		if (!appConfig || appConfig.disabled) {
			logger.debug('Not creating WebApp:', appName, appConfig ? '(disabled)' : '(no configuration found)');
			return setImmediate(callback);
		}

		logger.debug('Creating WebApp:', appName);

		var app = new WebApp(appName, appConfig);

		app.commandCenter.setup(function (error) {
			if (error) {
				return callback(error);
			}

			appMap[appName] = app;
			appList.push(app);

			callback();
		});
	}, cb);
};


/**
 * Loads and builds apps. This should be a noop in development mode.
 *
 * @param {Function} cb
 */

exports.buildApps = function (cb) {
	async.eachSeries(appList, function (app, callback) {
		// try to load builds from disk if they happen to exist

		app.loadBuilds(function (error) {
			if (error) {
				return callback(error);
			}

			// create missing builds

			app.makeBuilds(callback);
		});
	}, cb);
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


exports.getPublicConfig = function (baseUrl, app) {
	return {
		url: baseUrl + '/app/' + app.name,
		cors: mage.core.httpServer.getCorsConfig()
	};
};
