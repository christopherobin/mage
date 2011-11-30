var mithril = require('../../../mithril');


exports.params = ['actorId'];


exports.execute = function (state, actorId, cb) {
	if (!actorId && state.session && state.session.actorId) {
		actorId = state.session.actorId;
	}

	mithril.actor.getActor(state, actorId, function (error, actor) {
		if (!error) {
			state.respond(actor);
		}

		cb();
	});
};

