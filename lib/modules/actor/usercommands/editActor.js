var mithril = require('../../../mithril');


exports.params = ['actorId', 'data'];


exports.execute = function (state, actorId, data, cb) {
	mithril.actor.getActorProperties(state, actorId, { loadAll: true }, function (error, propMap) {
		if (error) {
			return cb(error);
		}

		var props = {};

		for (var i = 0, len = data.length; i < len; i += 1) {
			var prop = data[i];
			propMap.set(prop.property, prop.value, prop.language, prop.tag);
			props[prop.property] = true;
		}

		var propList = propMap.propertyList;

		for (var i = 0; i < propList.length; i += 1) {
			var propName = propList[i].split('/')[0];
			if (!(propName in props)) {
				propMap.del(propName);
			}
		}

		cb();
	});
};

