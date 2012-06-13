var mithril = require('../../../mithril'),
	crypto = require('crypto');

exports.params = ['userId', 'token', 'tokenSecret'];

exports.execute = function (state, userId, token, tokenSecret, cb) {
	mithril.gree.didLogin(state, userId, token, tokenSecret, function (error) {
		if (error) {
			return cb(error);
		}

		cb();
	});
};

