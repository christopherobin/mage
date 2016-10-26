var mage = require('mage');

exports.acl = ['user'];
exports.params = ['newPassword'];

exports.execute = function (state, newPassword, cb) {
	var credentials = { username: state.actorId, password: newPassword };

	mage.user.changePassword(state, credentials, function (error) {
		if (error) {
			return state.error(error, error, cb);
		}

		return cb();
	});
};
