var mithril = require('../../../mithril');


exports.params = ['actorId'];


exports.execute = function (state, actorId, cb) {
	mithril.actor.getActorProperties(state, actorId, { loadAll: true }, function (error, actor) {
		if (error) {
			return cb(error);
		}

		console.log('actor >>>>>>>>>>>>>>>>>>>> ', actor);
		state.respond(actor);
		cb();
	});
};

