var semver = require('semver');

/**
 * If setImmediate doesn't exists, we implement our own version that uses nextTick. Be careful it
 * doesn't work exactly the same as the node 0.10 version. See http://nodejs.org/api/timers.html#timers_setimmediate_callback_arg
 * The setImmediate ID returned is always 0 in the shim and won't allow the user to clear a
 * setImmediate ID when running in 0.8 (as process.nextTick doesn't provide that functionality).
 *
 * @type {Function}
 */
global.setImmediate = global.setImmediate || function () {
	// most cases won't have any extra args, just call process.nextTick and return
	if (arguments.length === 1) {
		process.nextTick(arguments[0]);
		return 0;
	}

	// otherwise transform the arguments into an array and retrieve the callback
	var args = Array.prototype.slice.call(arguments),
		cb = args.shift(),
		that = this;

	// do on nextTick
	process.nextTick(function () { cb.apply(that, args); });

	return 0;
};

/**
 * We implement a clearImmediate shim, but it won't do anything! It's just to prevent 0.10 code from
 * breaking on 0.8 with a "call undefined" error.
 *
 * @type {Function}
 */
global.clearImmediate = global.clearImmediate || function () {};

/**
 * The fileOptions function take an array of options as expected by node 0.10 fs methods and extract
 * the encoding when running on 0.8
 *
 * @param {Object} options The options object
 * @return {Object|string} Based on the version of node, returns either the encoding or the object as is
 *
 * TODO: Remove those once 0.10 becomes the standard, and remove calls to fileOptions
 */
if (semver.lt(process.version, '0.10.0')) {
	// node before 0.10 takes only the encoding, return that (or undefined if not set)
	exports.fileOptions = function (options) {
		return options.encoding;
	};
} else {
	// node 0.10 love options, donc transform them
	exports.fileOptions = function (options) {
		return options;
	};
}