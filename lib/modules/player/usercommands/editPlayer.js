var mithril = require('../../../mithril');


exports.params = ['properties'];


exports.execute = function (state, properties, cb) {
	var propertyMap = new mithril.core.PropertyMap();

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
