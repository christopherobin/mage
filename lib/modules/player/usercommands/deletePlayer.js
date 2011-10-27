var mithril = require('../../../mithril');

exports.execute = function (state, params, cb) {
	// TODO: check whether I should delete EVERYTHING related to the player
	mithril.player.delPlayerActor(state, params, function (error) {
		if (error) {
			return cb(error);
		}

		cb();
	});
};
