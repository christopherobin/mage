exports.execute = function(state, p, cb)
{
	if (!p.actorId) p.actorId = state.session.playerId;

	mithril.actor.getActor(state, p.actorId, p.fields, function(error, actor) {
		if (error)
			state.error(1234);
		else
			state.respond(actor);

		cb();
	});
};

