var mage = require('../../../mage');
var logger = mage.logger;


exports.access = 'anonymous';

exports.params = ['client', 'channel', 'message', 'data'];


exports.execute = function (state, client, channel, message, data, cb) {
	var fnLog = logger[channel];
	if (!fnLog) {
		return state.error(null, 'Log channel ' + channel + ' does not exist', cb);
	}

	var version = state.session ? state.session.version : undefined;
	var actorId = state.actorId;

	if (!data) {
		data = {};
	}

	// augment data with client engine, actorId and the app version that the session is tied to

	data.client = data.client || client;
	data.actorId = data.actorId || actorId;
	data.version = data.version || version;

	fnLog.context(client);
	fnLog.data(data).log(message);

	cb();
};
