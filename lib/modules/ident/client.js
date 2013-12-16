exports.engines = {};
exports.user = null;


exports.check = function (engineName, credentials, control, cb) {
	if (typeof control === 'function') {
		cb = control;
		control = null;
	} else if (typeof credentials === 'function') {
		cb = credentials;
		credentials = null;
	}

	// authenticate

	exports.doCheck(engineName, credentials, control, function (error, user) {
		if (error) {
			return cb(error);
		}

		exports.user = user;

		cb(null, user);
	});
};


exports.setup = function (cb) {
	// getEngines has an anonymous access level, so should always be available.

	if (!exports.getEngines) {
		return cb(new Error('ident.getEngines user command missing. Make sure to include the server-side "ident" module.'));
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