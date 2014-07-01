var mage = require('mage');

exports.access = 'anonymous';
exports.params = ['password'];

exports.execute = function (state, password, callback) {
	mage.user.create(state, password, function (error, userId) {
		if (error) {
			return state.error(error, error, callback);
		}

		state.respond(userId);
		callback();
	});
};
