var EventEmitter = require('emitter');
var msgServer = require('msgServer');

exports = module.exports = new EventEmitter();
var actorId;

exports.setSessionKey = function (key) {
	exports.key = key;
	exports.emit('sessionKey.set', key);

	msgServer.registerCommandHook('mage.session', function () {
		return { key: exports.key };
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
