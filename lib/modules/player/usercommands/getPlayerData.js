var mithril = require('../../../mithril');


exports.params = ['actorId'];


exports.execute = function (state, actorId, cb) {
	mithril.player.getPlayerDetails(state, actorId, function (error, actor) {
		if (!error) {
			state.respond(actor);
		}

		cb();
	});
};

