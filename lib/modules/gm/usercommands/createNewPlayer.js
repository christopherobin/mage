var mithril = require('../../../mithril');

exports.execute = function (state, params, cb) {
	if (mithril.gm.onNewPlayer) {
		mithril.gm.onNewPlayer(state, params, function (error, gm) {
			if (error) {
				mithril.core.logger.error(error);
				return cb(error);
			}

			state.respond(gm);
			cb(null, gm);
		});
	} else {
		cb('No onNewPlayer function registered.');
	}
};

