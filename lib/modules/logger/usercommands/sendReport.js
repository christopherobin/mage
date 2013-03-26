var mage = require('../../../mage');
var logger = mage.logger;


exports.params = ['client', 'channel', 'message', 'data'];


exports.execute = function (state, client, channel, message, data, cb) {
	var fnLog = logger[channel];
	if (!fnLog) {
		return state.error(null, 'Log channel does not exist', cb);
	}

	var version = state.session ? state.session.version : undefined;
	var actorId = state.actorId;

	var userData = {};

	if (client) {
		userData.client = client;
	}

	if (actorId) {
		userData.actorId = actorId;
	}

	if (version) {
		userData.version = version;
	}

	if (data) {
		userData.data = data;
	}

	fnLog.context(client);
	fnLog.data(userData).log(message);

	cb();
};
