var mage = require('../../../mage');

exports.params = ['userId', 'token', 'tokenSecret'];

exports.execute = function (state, userId, token, tokenSecret, cb) {
	mage.gree.didLogin(state, userId, token, tokenSecret, cb);
};

