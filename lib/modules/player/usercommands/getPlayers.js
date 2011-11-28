var mithril = require('../../../mithril');

exports.execute = function (state, params, cb) {
	mithril.player.getPlayers(state, function (errors, players) {
		if (errors) {
			return cb(errors);
		}

		// TODO: make proper JSON out of all the property maps and then call state.respondJson()

		state.respond(players);
		cb();
	});
};
