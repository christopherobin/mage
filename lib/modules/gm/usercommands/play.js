var mage = require('../../../mage');

exports.access = 'admin';

exports.params = ['actorId'];

exports.execute = function (state, actorId, cb) {
	if (mage.gm.onLogin) {
		mage.gm.onLogin(state, actorId, function (error, redirect) {
			if (!error) {
				state.respond(redirect);
			}

			cb();
		});
	} else {
		state.error(null, 'No onLogin function registered.', cb);
	}
};

