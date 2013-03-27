var session = require('../../../mage').session;

exports.execute = function (state, cb) {
	var actorId = 'RANDOM ACTORID!';
	session.register(state, actorId, null, null, function (error, session) {
		var data = { session: session.getFullKey(), actorId: actorId };
		state.respond(data);
		cb();
	});
};
