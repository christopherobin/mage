var mithril = require('../../../mithril.js');


exports.execute = function(state, p, cb)
{
	mithril.gree.resolvePlayer(state, state.actorId, function(error, user) {
		if (error) return cb();

		mithril.gree.rest.getFriends(state, user, true, p, function(error, friends) {
			if (!error)
				state.respond(friends);

			cb();
		});
	});
};

