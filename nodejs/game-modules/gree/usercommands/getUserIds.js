exports.execute = function(state, p, cb)
{
	mithril.gree.resolvePlayer(state, state.actorId, function(error, user) {
		if (error) return cb();

		mithril.gree.getUserIds(state, p.actorIds, function(error, userMap) {
			if (!error)
				state.respond(userMap);

			cb();
		});
	});
};

