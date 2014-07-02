var mage = require('mage');

var tUser = {};

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

exports.setup = function (cb) {
	mage.eventManager.on('io.ident.login', function (response) {
		var userId = response.user.userId;
		var query = {
			user: {
				topic: 'user',
				index: { userId: userId }
			}
		};

		mage.archivist.mget(query, {}, function (error, data) {
			if (error) {
				return console.error('Could not get user data:', error);
			}

			tUser = data.user;
			for (var key in tUser) {
				if (tUser.hasOwnProperty(key)) {
					exports[key] = tUser[key];
				}
			}
		});
	});

	cb();
};
