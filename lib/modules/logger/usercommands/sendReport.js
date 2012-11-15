var logger = require('../index');

exports.params = ['client', 'channel', 'message', 'data'];

exports.execute = function (state, client, channel, message, data, cb) {
	var log = logger[channel];

	if (log && logger.has(channel)) {
		var session = state.session;
		var actorId = state.actorId;

		var userData = {
			client: client,
			actorId: actorId || null,
//			language: session ? session.language : null,
			version: session ? session.version : null,
		};

		log(message).data(userData).data(data);

		state.respond(true);
	} else {
		state.respond(false);
	}

	cb();
};

