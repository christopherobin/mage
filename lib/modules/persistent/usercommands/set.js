var mithril = require('../../../mithril');


exports.params = ['properties', 'ttl'];


exports.execute = function (state, properties, ttl, cb) {
	if (!properties) {
		return cb();
	}

	var propertyMap = new mithril.core.PropertyMap();

	for (var key in properties) {
		propertyMap.add(key, properties[key]);
	}

	var expirationTime = ttl ? mithril.core.time + ~~ttl : 0;

	mithril.persistent.set(state, propertyMap, expirationTime, cb);
};

