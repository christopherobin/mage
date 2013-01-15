var mage = require('../../../mage');


exports.params = ['properties', 'ttl'];


exports.execute = function (state, properties, ttl, cb) {
	if (!properties) {
		return cb();
	}

	var propertyMap = new mage.core.PropertyMap();

	for (var key in properties) {
		propertyMap.add(key, properties[key]);
	}

	var expirationTime = ttl ? mage.core.time + ~~ttl : 0;

	mage.persistent.set(state, propertyMap, expirationTime, cb);
};

