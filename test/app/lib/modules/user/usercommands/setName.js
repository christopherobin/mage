var mage = require('mage');

exports.access = 'user';
exports.params = ['name'];

exports.execute = function (state, name, callback) {
	var userId = state.actorId;

	mage.user.get(state, userId, function (error, tUser) {
		if (error) {
			return state.error(error, error, callback);
		}

		try {
			mage.user.setName(tUser, name);
		} catch (e) {
			return state.error(e.message, e, callback);
		}

		callback();
	});
};
