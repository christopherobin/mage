var mithril = require('../../../mithril');

exports.params = ['username'];

exports.execute = function (state, username, cb) {
	if (mithril.gm.onNewPlayer) {
		mithril.gm.onNewPlayer(state, username, function (error, gm) {
			if (!error) {
				state.respond(gm);
			}

			cb();
		});
	} else {
		state.error(null, 'No onNewPlayer function registered.', cb);
	}
};

