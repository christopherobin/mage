var mage = require('../mage');


// pre-exposed builders

var builders = {};


exports.add = function (name, fn) {
	if (builders.hasOwnProperty(name)) {
		mage.core.logger.warning('Overwriting builder', name);
	}

	builders[name] = fn;
};


exports.get = function (name) {
	return builders[name] || null;
};


// CustomBuilder class, that allows developers to register any builder name, and have each key run a given external build function

function CustomBuilder() {
	this.keys = {};
}

exports.CustomBuilder = CustomBuilder;


CustomBuilder.prototype.registerKey = function (key, fnBuild) {
	this.keys[key] = fnBuild;
};


CustomBuilder.prototype.build = function (page, clientConfig, contextName, key, cb) {
	var fn = this.keys[key];

	if (fn) {
		fn(page, clientConfig, contextName, key, cb);
	} else {
		mage.core.logger.error('Unknown key "' + key + '" for CustomBuilder.');
		cb('unknownKey');
	}
};

