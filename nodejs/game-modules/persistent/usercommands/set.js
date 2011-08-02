var mithril = require('../../../mithril.js');


exports.execute = function(state, p, cb)
{
	if (!p.properties)
	{
		return cb();
	}

	var propertyMap = new mithril.core.PropertyMap;
	for (var key in p.properties)
	{
		var value = p.properties[key];

		propertyMap.add(key, value);
	}

	mithril.persistent.set(state, propertyMap, p.expirationTime || 0, cb);
};

