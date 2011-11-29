var mithril = require('../../../mithril');


exports.params = [];


exports.execute = function (state, params, cb) {
	mithril.player.getPlayers(state, function (errors, players) {
		if (errors) {
			return cb(errors);
		}

		state.respond(players);
		cb();
	});
};
