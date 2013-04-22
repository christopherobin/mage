var mage = require('../../../mage');


exports.access = 'user';

exports.params = ['actorId'];


exports.execute = function (state, actorId, cb) {
	if (!actorId && state.session && state.session.actorId) {
		actorId = state.session.actorId;
	}

	mage.actor.getActor(state, actorId, function (error, actor) {
		if (!error) {
			state.respond(actor);
		}

		cb();
	});
};

