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


exports.createApps = function () {
	var appsConfig = mage.core.config.get(['apps']);

	for (var appName in appsConfig) {
		if (appsConfig.hasOwnProperty(appName)) {
			var config = appsConfig[appName];

			if (config && !config.disabled) {
				logger.debug('Creating WebApp:', appName);

				var app = new WebApp(appName, config);

				app.commandCenter.setup();

				appMap[appName] = app;
				appList.push(app);
			} else {
				logger.debug('Not creating WebApp:', appName, '(no configuration found)');
			}
		}
	}
};


/**
 * Loads and builds apps. This can be a noop if serverCache is disabled on all apps.
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


exports.exposeAppsOnClientHost = function () {
	appList.forEach(function (app) {
		app.exposeOnClientHost();
	});
};


exports.register = function (name/*, app */) {
	throw new Error('app.register() is no longer supported (while trying to register: ' + name + ')');
};

// app getters

exports.get = function (name) {
	return appMap[name];
};

exports.getAppList = function () {
	return appList;
};

exports.getAppMap = function () {
	return appMap;
};
