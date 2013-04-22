var mage = require('../../../mage');


exports.access = 'admin';

exports.params = ['actorId', 'data'];


exports.execute = function (state, actorId, data, cb) {
	mage.actor.getActorProperties(state, actorId, { loadAll: true }, function (error, propMap) {
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
		var delList = [];

		for (var j = 0; j < propList.length; j += 1) {
			var propName = propList[j].split('/')[0];
			if (!(propName in props)) {
				delList.push(propName);
			}
		}

		for (var k = 0, klen = delList.length; k < klen; k += 1) {
			propMap.del(delList[k]);
		}

		cb();
	});
};

