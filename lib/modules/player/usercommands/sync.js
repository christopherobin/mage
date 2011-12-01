var mithril = require('../../../mithril');


exports.params = [];


exports.execute = function (state, cb) {
	mithril.player.getPlayer(state, state.actorId, ['language'], function (error, player) {
		if (!error) {
			state.respond({ me: player });
		}

		cb();
	});
};

