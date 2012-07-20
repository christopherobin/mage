var gree = require('../../../mithril').gree;

exports.params = ['userId', 'paymentId', 'nonce', 'timestamp', 'hash'];

exports.execute = function (state, userId, paymentId, nonce, timestamp, hash, cb) {
	gree.completePurchase(state, userId, paymentId, nonce, timestamp, hash, function (error, data) {
		if (error) {
			return cb(error);
		}

		if (data) {
			state.respond(data);
		}

		cb();
	});
};

