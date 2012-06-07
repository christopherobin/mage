var mithril = require('../../../mithril'),
	crypto = require('crypto');

exports.params = ['userId', 'token', 'tokenSecret'];

exports.execute = function (state, userId, token, tokenSecret, cb) {
	var nonce = 'HACK!',
		timestamp = 'HACK!',
		src = tokenSecret + nonce + timestamp + userId,
		hash = crypto.createHash('sha256').update(src).digest('hex');

	mithril.gree.didLogin(state, userId, token, tokenSecret, function (error) {
		if (error) {
			return cb(401);
		}

		mithril.gree.getSession(state, userId, nonce, timestamp, hash, function (error, sessionId) {
			if (!error) {
				state.respond(sessionId);
			}

			cb();
		});
	});
};

