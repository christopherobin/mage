var EventEmitter = require('emitter');
var mage = require('mage');

exports = module.exports = new EventEmitter();


var sessionKey;
var actorId;


function commandHook() {
	return { key: sessionKey };
}


// Some day, we'll need to deprecate actorId from this module.
// It's the login system that needs to provide an actor ID, not the session system

exports.getActorId = function () {
	return actorId;
};

exports.setActorId = function (id) {
	actorId = id;
};


exports.getKey = function () {
	return sessionKey;
};

exports.setKey = function (key) {
	if (key === sessionKey) {
		// no change
		return;
	}

	sessionKey = key;

	if (key) {
		mage.httpServer.registerCommandHook('mage.session', commandHook);

		// we want to receive auth errors on the eventManager again

		mage.eventManager.unblock('io.error.auth.**');
	} else {
		mage.httpServer.unregisterCommandHook('mage.session');
	}
};

/**
 * @deprecated
 */

exports.setSessionKey = exports.setKey;


mage.eventManager.on('session.set', function (path, info) {
	exports.setActorId(info.actorId);
	exports.setKey(info.key);
});


mage.eventManager.on('session.unset', function () {
	exports.setActorId(null);
	exports.setKey(null);
});


mage.eventManager.on('io.error.auth', function () {
	// we want to avoid receiving auth errors on the eventManager again until we're re-authenticated

	mage.eventManager.block('io.error.auth.**');

	exports.setActorId(null);
	exports.setKey(null);
});
