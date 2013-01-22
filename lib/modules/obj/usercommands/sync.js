var mage = require('../../../mage'),
    async = require('async');


exports.params = [];


exports.execute = function (state, cb) {
	var options = {
		actorId: state.actorId,
		addCategories: true,
		addClasses: true,
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

