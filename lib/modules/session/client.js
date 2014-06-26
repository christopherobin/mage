var EventEmitter = require('emitter');
var mage = require('mage');

exports = module.exports = new EventEmitter();

var session = {
	key: null,
	actorId: null
};


exports.setSessionKey = function (key, actorId) {
	session = {
		key: key,
		actorId: actorId
	};

	exports.emit('sessionKey.set', key);

	mage.httpServer.registerCommandHook('mage.session', function () {
		return { key: key };
	});
};

exports.getActorId = function () {
	return session.actorId;
};

exports.getKey = function () {
	return session.key;
};
