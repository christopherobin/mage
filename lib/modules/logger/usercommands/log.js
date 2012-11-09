var logger = require('../index');

exports.params = ['client', 'channel', 'message', 'data'];

exports.execute = function (state, client, channel, message, data, cb) {
	// TODO: the given data argument is not being logged?

	var log = logger[channel];

	if (log && logger.has(channel)) {
		var userData = {
			client: client,
			actorId: state.actorId,
			language: state.session.language,
			version: state.session.version,
		};

		log(message).data(userData).data(data);

		state.respond('stored');
	} else {
		state.respond('disabled');
	}

	cb();
};

