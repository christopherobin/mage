var mithril = require('../../../mithril');


exports.params = [];


exports.execute = function (state, p, cb) {
	var result = {};

	// fetch all relation requests I'm involved in

	mithril.sns.getRelationRequests(state, { actorId: state.actorId }, function (error, requests) {
		if (error) {
			return cb();
		}

		// fetch all relations I'm involved in

		mithril.sns.getRelations(state, { actorId: state.actorId }, function (error, relations) {
			if (error) {
				return cb();
			}

			state.respond({
				requests: requests,
				relations: relations
			});

			cb();
		});
	});
};

