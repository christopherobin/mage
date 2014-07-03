var mage = require('mage');

var tUser = {};

exports.login = function (username, password, cb) {
	function login(username) {
		mage.ident.login('testEngine', { username: username, password: password }, null, function (error) {
			if (error) {
				return cb(error);
			}

			cb();
		});
	}

	if (username !== 'new') {
		return login(username);
	}

	mage.user.register(password, function (error, username) {
		if (error) {
			return cb(error);
		}

		login(username);
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
