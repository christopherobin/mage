var mithril = require('../../../mithril');

exports.execute = function (state, p, cb) {
	mithril.player.getPlayerDetails(state, p.actorId, function (error, actor) {
		if (!error) {
			state.respond(actor);
		}

		cb();
	});
};

