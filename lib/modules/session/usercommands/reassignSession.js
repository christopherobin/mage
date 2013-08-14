var mage = require('../../../mage');


exports.access = 'admin';
exports.params = ['fromActorId', 'toActorId'];


// Interesting side note:
// While reassigning the session, the command response will contain the removal of the old session.
// It's the asynchronous message stream that will yield the new session object, the moment this
// callback calls setSessionKey and the message stream becomes associated with the new actor ID.
// This is normal as the new session index { actorId: toActorId } won't be sharded with the current
// user command's state.

exports.execute = function (state, fromActorId, toActorId, cb) {
	// if no fromActorId is given, the state's associated actorId will be used

	fromActorId = fromActorId || state.actorId;

	mage.session.reassignSession(state, fromActorId, toActorId, cb);
};
