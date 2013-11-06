global.setImmediate = global.setImmediate || function () {
	// transform the arguments into an array and retrieve the callback
	var args = Array.prototype.slice.call(arguments),
		cb = args.shift(),
		that = this;

	// do on nextTick
	process.nextTick(function () { cb.apply(that, args); });
};