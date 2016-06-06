var mage = require('mage');

exports.acl = ['*'];
exports.params = ['password'];

exports.execute = function (state, password, cb) {
	mage.user.create(state, password, function (error, username) {
		if (error) {
			return state.error(error, error, cb);
		}

		state.respond(username);
		cb();
	});
};
