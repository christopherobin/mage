var mage = require('../../../mage');

exports.access = 'anonymous';
exports.params = ['sessionKey'];

exports.execute = function (state, sessionKey, cb) {
	mage.session.resolve(state, sessionKey, function (err) {
		if (err) {
			return state.error(err, err, cb);
		}

		cb();
	});
};
