var mithril = require('../../../mithril'),
	crypto = require('crypto');

exports.params = ['userId', 'paymentId', 'nonce', 'timestamp', 'hash'];

exports.execute = function (state, userId, paymentId, nonce, timestamp, hash, cb) {
	mithril.gree.completePurchase(state, userId, paymentId, nonce, timestamp, hash, function (error, data) {
		if (error) {
			return cb(error);
		}

		if (data !== undefined) {
			state.respond(data);
		}

		cb();
	});
};

