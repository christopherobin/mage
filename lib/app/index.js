var mithril = require('../mithril');

exports.builders = require('./builders');
exports.contexts = require('./contexts');
exports.web = require('./web');
exports.BuildTarget = require('./buildTarget').BuildTarget;

// register some core builders

require('./corebuilders').register();


// register some core contexts

exports.contexts.add('bin', 'application/octet-stream', '\n').addFileExtensions(['*']);


// CustomBuilder class, that allows developers to register any builder name, and have each key run a given external build function

function CustomBuilder() {
	this.keys = {};
}

exports.CustomBuilder = CustomBuilder;


CustomBuilder.prototype.registerKey = function (key, fnBuild) {
	this.keys[key] = fnBuild;
};


CustomBuilder.prototype.build = function (buildTarget, language, contextName, key, cb) {
	var fn = this.keys[key];

	if (fn) {
		fn(buildTarget, language, contextName, key, cb);
	} else {
		mithril.core.logger.error('Unknown key "' + key + '" for CustomBuilder.');
		cb('unknownKey');
	}
};


