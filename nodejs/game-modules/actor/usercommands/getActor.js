var mithril = require('../../../mithril.js');


exports.execute = function(state, p, cb)
{
	if (!p.actorId) p.actorId = state.session.playerId;

	mithril.actor.getActor(state, p.actorId, function(error, actor) {
		if (!error)
			state.respond(actor);

		cb();
	});
};

