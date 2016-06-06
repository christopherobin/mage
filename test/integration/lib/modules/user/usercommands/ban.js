var mage = require('mage');

exports.acl = ['admin'];
exports.params = ['userId', 'reason'];

exports.execute = function (state, userId, reason, cb) {
	mage.ident.ban(state, userId, reason, function (error) {
		if (error) {
			return state.error(error.message || error, error, cb);
		}

		state.respond();
		cb();
	});
};
