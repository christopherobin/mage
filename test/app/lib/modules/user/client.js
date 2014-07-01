var mage = require('mage');

exports.login = function (userId, password, cb) {
	function login(userId) {
		mage.ident.login('testEngine', { username: userId, password: password }, null, function (error) {
			if (error) {
				return cb(error);
			}

			cb();
		});
	}

	if (userId !== 'new') {
		return login(userId);
	}

	mage.user.register(password, function (error, userId) {
		if (error) {
			return cb(error);
		}

		login(userId);
	});
};
