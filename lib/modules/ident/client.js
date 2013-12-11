exports.engines = {};


exports.check = function (engineName, credentials, control, cb) {
	if (typeof control === 'function') {
		cb = control;
		control = null;
	} else if (typeof credentials === 'function') {
		cb = credentials;
		credentials = null;
	}

	// authenticate

	exports.doCheck(engineName, credentials, control, cb);
};


exports.setup = function (cb) {
	// getEngines has an anonymous access level, so should always be available.

	if (!exports.getEngines) {
		return cb(new Error('ident.getEngines user command missing. Make sure to include the server module.'));
	}

	// call the server to get the list of available auth engines for the current app
	exports.getEngines(function (err, engines) {
		if (err) {
			return cb(err);
		}

		exports.engines = engines;

		cb();
	});
};