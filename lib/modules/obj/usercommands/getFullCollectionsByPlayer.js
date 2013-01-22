var mage = require('../../../mage');
var async   = require('async');


exports.params = ['actorId'];


exports.execute = function (state, actorId, cb) {
	var options = {
		actorId: actorId,
		addCollections: true,
		addObjects: true
	};

	mage.obj.getSyncData(state, options, function (error, jsonData) {
		if (error) {
			return cb();
		}

		state.respondJson(jsonData);
		cb();
	});
};

