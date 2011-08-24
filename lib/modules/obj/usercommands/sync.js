var mithril = require('../../../mithril'),
    async = require('async');


exports.execute = function (state, p, cb) {
	var options = {
		actorId: state.actorId,
		addCategories: true,
		addClasses: true,
		addCollections: true,
		addObjects: true
	};

	mithril.obj.getSyncData(state, options, function (error, data) {
		if (error) {
			return cb();
		}

		state.respond(data);
		cb();
	});
};

