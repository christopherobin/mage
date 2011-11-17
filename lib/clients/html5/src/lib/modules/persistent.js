(function () {

	var mithril = window.mithril;

	var mod = {};

	mithril.registerModule('persistent', mod);


	mod.getAll = function (cb) {
		mithril.io.send('persistent.getAll', {}, null, cb);
	};


	mod.get = function (properties, removeAfterGet, cb) {
		if (!Array.isArray(properties)) {
			properties = [properties];
		}

		mithril.io.send('persistent.get', { properties: properties, removeAfterGet: !!removeAfterGet }, null, cb);
	};


	mod.set = function (data, ttl, cb) {
		var options = { properties: data };

		if (ttl) {
			options.ttl = ttl;
		}

		mithril.io.send('persistent.set', options, null, cb);
	};


	mod.del = function (properties, cb) {
		mithril.io.send('persistent.del', { properties: properties }, null, cb);
	};


	mod.clear = function (cb) {
		mithril.io.send('persistent.clear', {}, null, cb);
	};

}());
