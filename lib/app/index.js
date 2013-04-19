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


exports.setup = function () {
	var appsConfig = mage.core.config.get('apps');

	for (var appName in appsConfig) {
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
};


exports.register = function (name/*, app */) {
	throw new Error('app.register() is no longer supported (while trying to register: ' + name + ')');
};

// app getter

exports.get = function (name) {
	return appMap[name];
};


exports.getAppList = function () {
	return appList;
};

exports.getAppMap = function () {
	return appMap;
};
