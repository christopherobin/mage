exports.engines = {};

exports.check = function (engine, params, cb) {
	// user can omit params for some of the engines
	if (typeof params === "function") {
		cb = params;
		params = {};
	}

	// call the real authenticate function
	exports.doCheck(engine, params, cb);
};

exports.setup = function (cb) {
	// call the server to get the list of available auth engines
	exports.getEngines(function (err, engineList) {
		if (err) {
			return cb(err);
		}

		exports.engines = engineList;
		cb();
	});
};