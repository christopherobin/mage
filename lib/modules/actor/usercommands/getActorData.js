var mage = require('../../../mage');


exports.params = ['actorId'];


exports.execute = function (state, actorId, cb) {
	mage.actor.getActorProperties(state, actorId, { loadAll: true }, function (error, actor) {
		if (error) {
			return cb(error);
		}

		state.respond(actor.getAll());
		cb();
	});
};

