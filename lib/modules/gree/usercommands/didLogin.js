var mithril = require('../../../mithril');

exports.params = ['userId', 'token', 'tokenSecret'];

exports.execute = function (state, userId, token, tokenSecret, cb) {
	mithril.gree.didLogin(state, userId, token, tokenSecret, cb);
};

