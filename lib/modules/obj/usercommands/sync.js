var mithril = require('../../../mithril'),
    async = require('async');


exports.execute = function (state, p, cb) {
	mithril.obj.getSyncData(state, { actorId: state.actorId, addClasses: true, addCollections: true, addObjects: true }, function (error, data) {
		if (error) {
			return cb();
		}

		state.respond(data);
		cb();
	});
};

