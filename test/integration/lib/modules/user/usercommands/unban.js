var mage = require('mage');

exports.access = 'admin';
exports.params = ['username'];

exports.execute = function (state, username, cb) {
	mage.user.unban(state, username, function (error) {
		if (error) {
			return state.error(error.message || error, error, cb);
		}

		state.respond();
		cb();
	});
};
