var mithril = require('../../../mithril.js');


exports.execute = function(state, p, cb)
{
	mithril.actor.getActor(state, state.actorId, function(error, actor) {
		if (!error)
			state.respond({ me: actor });

		cb();
	});
};

