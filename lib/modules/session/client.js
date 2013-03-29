var EventEmitter = require('emitter');
var msgServer = require('msgServer');

exports = module.exports = new EventEmitter();

exports.setSessionKey = function (key) {
	exports.key = key;
	exports.emit('sessionKey.set', key);
};

exports.startAnonymousSession = function () {
	if (!exports.randomSession) {
		return console.log('Anonymous sessions are not enabled.');
	}

	exports.randomSession(function (error, data) {
		if (error) {
			return console.log(error);
		}
		exports.setSessionKey(data.session);
		exports.actorId = data.actorId;
	});
};

msgServer.registerCommandHook('mage.session', function () {
	return { key: exports.key };
});

exports.setup = function (cb) {
	cb();
};