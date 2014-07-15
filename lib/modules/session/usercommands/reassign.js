var mage = require('../../../mage');

exports.access = 'anonymous';
exports.params = ['fromActorId', 'toActorId'];

// Interesting side note:
// While reassigning the session, the command response will contain the removal of the old session.
// It's the asynchronous message stream that will yield the new session object, the moment this
// callback calls setSessionKey and the message stream becomes associated with the new actor ID.
// This is normal as the new session index { actorId: toActorId } won't be sharded with the current
// user command's state.

exports.execute = function (state, fromActorId, toActorId, cb) {
	if (!mage.isDevelopmentMode('loginAs')) {
		return state.error(null, 'Identity change is only allowed in development mode.', cb);
	}

	// if no fromActorId is given, the state's associated actorId will be used

	fromActorId = fromActorId || state.actorId;

	if (!fromActorId) {
		return state.error(null, 'Missing fromActorId', cb);
	}

	if (!toActorId) {
		return state.error(null, 'Missing toActorId', cb);
	}

	mage.session.reassignSession(state, fromActorId, toActorId, cb);
};
