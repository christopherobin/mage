var mithril = require('../../../mithril');


exports.params = ['properties', 'ttl'];


exports.execute = function (state, p, cb) {
	if (!p.properties) {
		return cb();
	}

	var propertyMap = new mithril.core.PropertyMap();

	for (var key in p.properties) {
		propertyMap.add(key, p.properties[key]);
	}

	var expirationTime = p.ttl ? mithril.core.time + ~~p.ttl : 0;

	mithril.persistent.set(state, propertyMap, expirationTime, cb);
};

