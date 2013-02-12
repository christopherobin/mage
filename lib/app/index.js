exports.builders = require('./builders');
exports.contexts = require('./contexts');
exports.web = require('./web');
exports.BuildTarget = require('./buildTarget').BuildTarget;


// register some core builders

require('./corebuilders').register();


// register some core contexts

exports.contexts.add('bin', 'application/octet-stream', '\n').addFileExtensions(['*']);


// app registration

var apps = {};
var appList = [];

exports.register = function (name, app) {
	apps[name] = app;
	appList.push(app);
};


// app getter

exports.get = function (name) {
	return apps[name];
};

exports.getAppList = function () {
	return appList;
};
