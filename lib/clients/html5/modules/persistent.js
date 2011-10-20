(function () {

	var mithril = window.mithril;

	var mod = {};

	mithril.registerModule('persistent', mod);


	var cache = null;


	mod.setup = function (cb) {
		mithril.io.send('persistent.sync', {}, function (errors, data) {
			if (errors) {
				return cb(errors);
			}

			cache = data;
			cb(null, data);		// TODO: do we really return the data here?
		});
	};


	mod.getAll = function (cb) {
		mithril.io.send('persistent.getAll', {}, function (errors, data) {
			if (errors) {
				return cb(errors);
			}

			cache = data;	// also synchronizes the data
			cb(null, data);
		});
	};


	mod.get = function (properties, removeAfterGet, cb) {
		if (!Array.isArray(properties)) {
			properties = [properties];
		}

		mithril.io.send('persistent.get', { properties: properties, removeAfterGet: !!removeAfterGet }, function (errors, data) {
			if (errors) {
				return cb(errors);
			}

			for (var key in data) {
				if (removeAfterGet) {
					delete data[key];
				} else {
					cache[key] = data[key];
				}
			}

			cb(null, data);
		});
	};


	mod.set = function (data, ttl, cb) {
		var options = { properties: data };

		if (ttl) {
			options.ttl = ttl;
		}

		mithril.io.send('persistent.set', options, function (errors) {
			if (errors) {
				if (cb) {
					cb(errors);
				}
				return;
			}

			for (var key in data) {
				cache[key] = data[key];
			}

			if (cb) {
				cb();
			}
		});
	};


	mod.del = function (properties, cb) {
		mithril.io.send('persistent.del', { properties: properties }, function (errors) {
			if (errors) {
				if (cb) {
					cb(errors);
				}
				return;
			}

			var len = properties.length;
			for (var i = 0; i < len; i++) {
				delete cache[properties[i]];
			}

			if (cb) {
				cb();
			}
		});
	};


	mod.clear = function (cb) {
		mithril.io.send('persistent.clear', {}, function (errors) {
			if (errors) {
				if (cb) {
					cb(errors);
				}
				return;
			}

			cache = {};

			if (cb) {
				cb();
			}
		});
	};

}());
