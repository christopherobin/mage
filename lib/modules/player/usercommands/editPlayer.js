var mithril = require('../../../mithril');


exports.params = ['playerId', 'properties'];


exports.execute = function (state, playerId, properties, cb) {
	var propertyMap = new mithril.core.PropertyMap();

	for (var prop in properties) {
		var property = prop;
		var value    = properties[prop];

		propertyMap.add(property, value);
	}

	mithril.actor.setProperties(state, playerId, propertyMap, function (error) {
		if (error) {
			return cb(error);
		}

		cb();
	});
};
