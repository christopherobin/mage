var mage = require('../../../mage');


exports.params = [];


exports.execute = function (state, cb) {
	var result = {};

	// fetch all relation requests I'm involved in

	mage.sns.getRelationRequests(state, { actorId: state.actorId }, function (error, requests) {
		if (error) {
			return cb();
		}

		// fetch all relations I'm involved in

		mage.sns.getRelations(state, { actorId: state.actorId }, function (error, relations) {
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

