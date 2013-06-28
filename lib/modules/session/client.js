var EventEmitter = require('emitter');

exports = module.exports = new EventEmitter();
var actorId;

exports.setSessionKey = function (key) {
	exports.emit('sessionKey.set', key);

	require('mage').msgServer.registerCommandHook('mage.session', function () {
		return { key: key };
	});
};

exports.startAnonymousSession = function (cb) {
	if (!exports.randomSession) {
		return console.log('Anonymous sessions are not enabled.');
	}

	exports.randomSession(function (error, data) {
		if (error) {
			if (cb) {
				cb(error);
			}
			return;
		}

		exports.setSessionKey(data.session);
		actorId = data.actorId;

		if (cb) {
			cb();
		}
	});
};

exports.getActorId = function () {
	return actorId;
};
