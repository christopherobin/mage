(function () {

	var mithril = window.mithril;

	var mod = {};

	mithril.registerModule('persistent', mod);


	mod.getAll = function (cb) {
		mithril.io.send('persistent.getAll', {}, cb);
	};


	mod.get = function (properties, removeAfterGet, cb) {
		if (!Array.isArray(properties)) {
			properties = [properties];
		}

		mithril.io.send('persistent.get', { properties: properties, removeAfterGet: !!removeAfterGet }, cb);
	};


	mod.set = function (data, ttl, cb) {
		var options = { properties: data };

		if (ttl) {
			options.ttl = ttl;
		}

		mithril.io.send('persistent.set', options, function (error) {
			if (cb) {
				cb(error);
			}
		});
	};


	mod.del = function (properties, cb) {
		mithril.io.send('persistent.del', { properties: properties }, function (error) {
			if (cb) {
				cb(error);
			}
		});
	};


	mod.clear = function (cb) {
		mithril.io.send('persistent.clear', {}, function (error) {
			if (cb) {
				cb(error);
			}
		});
	};

}());
