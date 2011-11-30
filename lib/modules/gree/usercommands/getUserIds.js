var mithril = require('../../../mithril');


exports.params = ['actorIds'];


exports.execute = function (state, actorIds, cb) {
	mithril.gree.resolvePlayer(state, state.actorId, function (error, user) {
		if (error) {
			return cb();
		}

		mithril.gree.getUserIds(state, actorIds, function (error, userMap) {
			if (!error) {
				state.respond(userMap);
			}

			cb();
		});
	});
};

