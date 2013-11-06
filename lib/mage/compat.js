/**
 * If setImmediate doesn't exists, we implement our own version that uses nextTick. Be careful it
 * doesn't work exactly the same as the node 0.10 version. See http://nodejs.org/api/timers.html#timers_setimmediate_callback_arg
 *
 * @type {Function}
 */
global.setImmediate = global.setImmediate || function () {
	// transform the arguments into an array and retrieve the callback
	var args = Array.prototype.slice.call(arguments),
		cb = args.shift(),
		that = this;

	// do on nextTick
	process.nextTick(function () { cb.apply(that, args); });
};

/**
 * We implement a clearImmediate shim, but it won't do anything! It's just to prevent 0.10 code from
 * breaking on 0.8 with a "call undefined" error.
 *
 * @type {Function}
 */
global.clearImmediate = global.clearImmediate || function () {};
