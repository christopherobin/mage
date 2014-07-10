var mage = require('mage');

exports.access = 'anonymous';
exports.params = ['username', 'password'];

exports.execute = function (state, username, password, cb) {
	mage.user.login(state, username, password, function (error, result) {
		if (error) {
			return state.error(error.message || error, error, cb);
		}

		state.respond(result);
		cb();
	});
};
