var mithril = require('../../../mithril');

exports.execute = function (state, params, cb) {
	var propertyMap = new mithril.core.PropertyMap();
	var properties  = params.data;

	for (var prop in properties) {
		var property = prop;
		var value    = properties[prop];

		propertyMap.add(property, value);
	}

	mithril.actor.setProperties(state, params.id, propertyMap, function (error) {
		if (error) {
			return cb(error);
		}

		cb();
	});
};
