var mage = require('mage');

var tUser = {};

function setupUser(userId) {
	var query = {
		user: {
			topic: 'user',
			index: { userId: userId }
		}
	};

	mage.archivist.mget(query, { optional: true }, function (error, data) {
		if (error) {
			throw new Error(error);
		}

		tUser = data.user || {};

		for (var key in tUser) {
			if (tUser.hasOwnProperty(key)) {
				exports[key] = tUser[key];
			}
		}
	});
}

exports.setup = function (cb) {
	mage.eventManager.on('io.user.login', function (response) {
		setupUser(response.userId);
	});

	return cb();
};
