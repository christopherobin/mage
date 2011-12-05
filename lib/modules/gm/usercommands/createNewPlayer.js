var mithril = require('../../../mithril');

exports.params = ['username'];

exports.execute = function (state, username, cb) {
	if (mithril.gm.onNewPlayer) {
		mithril.gm.onNewPlayer(state, username, function (error, gm) {
			if (error) {
				mithril.core.logger.error(error);
				return cb(error);
			}

			state.respond(gm);
			cb(null, gm);
		});
	} else {
		state.error(null, 'No onNewPlayer function registered.', cb);
	}
};

