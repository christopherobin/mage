var mage  = require('../mage');

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

exports.register = function (name, app) {
	apps[name] = app;
};


// app getter

exports.get = function (name) {
	return apps[name];
};

