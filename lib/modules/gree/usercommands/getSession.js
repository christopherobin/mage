var mage = require('../../../mage');

exports.access = 'user';

exports.params = ['userId', 'nonce', 'timestamp', 'hash'];

exports.execute = function (state, userId, nonce, timestamp, hash, cb) {
	mage.gree.getSession(state, userId, nonce, timestamp, hash, function (error, sessionId) {
		if (error) {
			return cb(error);
		}

		state.respond(sessionId);
		cb();
	});
};

