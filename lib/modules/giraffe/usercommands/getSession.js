var mithril = require('../../../mithril');


exports.params = ['userId', 'nonce', 'timestamp', 'hash'];


exports.execute = function (state, userId, nonce, timestamp, hash, cb) {
	mithril.giraffe.getSession(state, userId, nonce, timestamp, hash, function (error, sessionId) {
		if (!error) {
			state.respond(sessionId);
		}

		cb();
	});
};

