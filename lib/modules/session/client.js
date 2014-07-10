var EventEmitter = require('emitter');
var mage = require('mage');

exports = module.exports = new EventEmitter();

var session = {
	key: null,
	actorId: null
};


function commandHook() {
	return { key: session.key };
}


exports.setSessionKey = function (key, actorId) {
	session = {
		key: key,
		actorId: actorId
	};

	if (key) {
		mage.httpServer.registerCommandHook('mage.session', commandHook);
	} else {
		mage.httpServer.unregisterCommandHook('mage.session');
	}
};


mage.eventManager.on('session.set', function (path, info) {
	exports.setSessionKey(info.key, info.actorId);
});


mage.eventManager.on('session.unset', function () {
	exports.setSessionKey(null, null);
});


exports.getActorId = function () {
	return session.actorId;
};

exports.getKey = function () {
	return session.key;
};
