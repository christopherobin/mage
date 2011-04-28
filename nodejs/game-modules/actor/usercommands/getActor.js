exports.execute = function(state, p, cb)
{
	var result = {};

	mithril.actor.getActor(state, p.actorId, p.fields, function(error, actor) {
		if (error)
			state.error(1234);
		else
			state.respond(actor);

		cb();
	});
};

