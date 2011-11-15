var mithril = require('../../../mithril');


exports.execute = function (state, p, cb) {
	if (!p.actorId && state.session && state.session.actorId) {
		p.actorId = state.session.actorId;
	}

	mithril.actor.getActor(state, p.actorId, function (error, actor) {
		if (!error) {
			state.respond(actor);
		}

		cb();
	});
};

