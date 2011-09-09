var mithril = require('../../../mithril');


exports.execute = function (state, p, cb) {
	if (!p.properties) {
		return cb();
	}

	var propertyMap = new mithril.core.PropertyMap();

	for (var key in p.properties) {
		propertyMap.add(key, p.properties[key]);
	}

	if (p.ttl) {
		p.expirationTime = mithril.core.time + ~~p.ttl;
	}

	mithril.persistent.set(state, propertyMap, p.expirationTime || 0, cb);
};

