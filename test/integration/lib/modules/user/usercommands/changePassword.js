var mage = require('mage');

exports.acl = ['user'];
exports.params = ['newPassword'];

exports.execute = function (state, newPassword, cb) {
	var userId = state.actorId;

	mage.user.changePassword(state, userId, newPassword, function (error) {
		if (error) {
			return state.error(error, error, cb);
		}

		return cb();
	});
};
