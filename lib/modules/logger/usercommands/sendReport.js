var mithril = require('../../../mithril');
var logger = mithril.core.logger;


exports.params = ['client', 'channel', 'message', 'data'];


exports.execute = function (state, client, channel, message, data, cb) {
	var fnLog = logger[channel];
	if (!fnLog) {
		return state.error(null, 'Log channel does not exist', cb);
	}

	var session = state.session;
	var actorId = state.actorId;

	var userData = {
		client: client,
		actorId: actorId || null,
		version: session ? session.version : null,
		data: data
	};

	fnLog(message).data(userData);

	cb();
};

