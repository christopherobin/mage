var session = require('../../../mage').session;
var uuid = require('node-uuid');

exports.execute = function (state, cb) {
	var actorId = uuid();
	session.register(state, actorId, null, null, function (error, session) {
		var data = { session: session.getFullKey(), actorId: actorId };
		state.respond(data);
		cb();
	});
};
