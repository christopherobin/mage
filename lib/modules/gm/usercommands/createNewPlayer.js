var mage = require('../../../mage');

exports.access = 'admin';

exports.params = ['username'];

exports.execute = function (state, username, cb) {
	if (mage.gm.onNewPlayer) {
		mage.gm.onNewPlayer(state, username, function (error, gm) {
			if (!error) {
				state.respond(gm);
			}

			cb();
		});
	} else {
		state.error(null, 'No onNewPlayer function registered.', cb);
	}
};

