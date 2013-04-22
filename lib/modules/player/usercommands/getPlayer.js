var mage = require('../../../mage');


exports.access = 'user';

exports.params = ['playerId', 'fields'];


exports.execute = function (state, playerId, fields, cb) {
	if (!playerId) {
		playerId = state.actorId;
	}

	mage.player.getPlayer(state, playerId, fields, function (error, player) {
		if (!error) {
			state.respond(player);
		}

		cb();
	});
};

