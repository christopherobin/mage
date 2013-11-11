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
 * This is a shim that implement node 0.10 type fs functions in 0.8, the flag option is ignored so
 * try not to use it too much unless you want some unexpected stuff happening
 *
 * TODO: Remove those once 0.10 becomes the standard
 */
if (semver.lt(process.version, '0.10.0')) {
	// we change the fs functions that take an encoding on 0.8 so that we can pass option objects
	var fs = require('fs');

	// reimplement readFile
	var _readFile = fs.readFile;
	fs.readFile = function (filename, options, callback) {
		if (typeof options === 'function') {
			callback = options;
			options = {};
		}

		// encoding is optional in that function, respect that
		if (options.encoding) {
			return _readFile(filename, options.encoding, callback);
		}

		return _readFile(filename, callback);
	};

	// fs.readFileSync
	var _readFileSync = fs.readFileSync;
	fs.readFileSync = function (filename, options) {
		options = options || {};

		// encoding is optional in that function, respect that
		if (options.encoding) {
			return _readFileSync(filename, options.encoding);
		}

		return _readFileSync(filename);
	};

	// fs.writeFile
	var _writeFile = fs.writeFile;
	fs.writeFile = function (filename, data, options, callback) {
		if (typeof options === 'function') {
			callback = options;
			options = {};
		}

		// encoding is optional in that function, respect that
		if (options.encoding) {
			return _writeFile(filename, data, options.encoding, callback);
		}

		return _writeFile(filename, data, callback);
	};

	// fs.writeFileSync
	var _writeFileSync = fs.writeFileSync;
	fs.readFileSync = function (filename, data, options) {
		options = options || {};

		// encoding is optional in that function, respect that
		if (options.encoding) {
			return _writeFileSync(filename, data, options.encoding);
		}

		return _writeFileSync(filename, data);
	};

	// fs.writeFile
	var _appendFile = fs.appendFile;
	fs.writeFile = function (filename, data, options, callback) {
		if (typeof options === 'function') {
			callback = options;
			options = {};
		}

		// encoding is optional in that function, respect that
		if (options.encoding) {
			return _appendFile(filename, data, options.encoding, callback);
		}

		return _appendFile(filename, data, callback);
	};

	// fs.writeFileSync
	var _appendFileSync = fs.appendFileSync;
	fs.readFileSync = function (filename, data, options) {
		options = options || {};

		// encoding is optional in that function, respect that
		if (options.encoding) {
			return _appendFileSync(filename, data, options.encoding);
		}

		return _appendFileSync(filename, data);
	};
}