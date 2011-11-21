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


exports.getAsync = function (name, cb) {
	var builder = builders[name];
	if (!builder) {
		mithril.core.logger.error('Builder not found:', name);
		return cb('noSuchBuilder');
	}

	cb(null, builder);
};


exports.build = function (builderName) {
	var args = [];

	for (var i = 1, len = arguments.length; i < len; i++) {
		args.push(arguments[i]);
	}

	var build = builders[builderName];
	if (build) {
		// run the builder on the given arguments

		build.apply(null, args);
	} else {
		// callback should be the last argument

		var cb = args.pop();

		mithril.core.logger.error('Builder not found:', builderName);
		cb('noSuchBuilder');
	}
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

