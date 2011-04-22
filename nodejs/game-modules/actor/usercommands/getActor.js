exports.execute = function(state, playerId, p, cb)
{
	var result = {};

	mithril.actor.getActor(state, p.actorId, p.fields, function(error, actor) {
		if (error)
		{
			state.msgClient.error(1234);
		}
		else
		{
			state.msgClient.respond(actor);
		}
		cb();
	});
};

