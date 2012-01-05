var mithril = require('../../../mithril');


exports.params = ['actorId'];


exports.execute = function (state, actorId, cb) {
	mithril.actor.getActorProperties(state, actorId, { loadAll: true }, function (error, actor) {
		if (error) {
			return cb(error);
		}

		state.respond(actor.getAll());
		cb();
	});
};

