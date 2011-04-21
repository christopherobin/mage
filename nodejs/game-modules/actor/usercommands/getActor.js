exports.execute = function(state, playerId, msg, cb)
{
	var result = {};

	mithril.actor.getActor(state, msg.p.actorId, msg.p.fields, function(error, actor) {
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
