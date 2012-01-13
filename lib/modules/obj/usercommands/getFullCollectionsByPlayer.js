var mithril = require('../../../mithril');
var async   = require('async');


exports.params = ['actorId'];


exports.execute = function (state, actorId, cb) {
	var options = {
		actorId: actorId,
		addCollections: true,
		addObjects: true
	};

	mithril.obj.getSyncData(state, options, function (error, jsonData) {
		if (error) {
			return cb();
		}

		state.respondJson(jsonData);
		cb();
	});
};

