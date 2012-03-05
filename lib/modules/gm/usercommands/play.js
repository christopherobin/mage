var mithril = require('../../../mithril');

exports.params = ['actorId'];

exports.execute = function (state, actorId, cb) {
	if (mithril.gm.onLogin) {
		mithril.gm.onLogin(state, actorId, function (error, redirect) {
			if (!error) {
				state.respond(redirect);
			}

			cb();
		});
	} else {
		state.error(null, 'No onLogin function registered.', cb);
	}
};

