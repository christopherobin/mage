var mithril = require('../../../mithril');


exports.params = ['playerId', 'fields'];


exports.execute = function (state, playerId, fields, cb) {
	if (!playerId) {
		playerId = state.actorId;
	}

	mithril.player.getPlayer(state, playerId, fields, function (error, player) {
		if (!error) {
			state.respond(player);
		}

		cb();
	});
};

