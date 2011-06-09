exports.execute = function(state, p, cb)
{
	mithril.gree.resolvePlayer(state, state.actorId, function(error, user) {
		if (error) return cb();

		mithril.gree.rest.getPeople(state, user, p.actorIds, { fields: p.fields }, function(error, people) {
			if (!error)
				state.respond(people);

			cb();
		});
	});
};

