var mithril = require('../mithril');


// pre-exposed builders

var builders = {};


exports.add = function (name, fn) {
	if (builders.hasOwnProperty(name)) {
		mithril.core.logger.info('Warning: overwriting builder', name);
	}

	builders[name] = fn;
};


exports.get = function (name) {
	return builders[name] || null;
};


function CustomBuilder() {
	this.keys = {};
}

exports.CustomBuilder = CustomBuilder;


CustomBuilder.prototype.registerKey = function (key, fnBuild) {
	this.keys[key] = fnBuild;
};


CustomBuilder.prototype.build = function (page, language, contextName, key, cb) {
	var fn = this.keys[key];

	if (fn) {
		fn(page, language, contextName, key, cb);
	} else {
		mithril.core.logger.error('Unknown key "' + key + '" for CustomBuilder.');
		cb('unknownKey');
	}
};

