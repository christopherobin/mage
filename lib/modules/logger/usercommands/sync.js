var mithril = require('../../../mithril');
var logger = mithril.core.logger;


exports.params = [];

exports.execute = function (state, cb) {
	var config = mithril.core.config.get('logging.html5');
	var channelConfig = {};

	for (var writerType in config) {
		var writerConfig = config[writerType];

		if (writerConfig && writerConfig.channels) {
			channelConfig[writerType] = logger.parseChannelList(writerConfig.channels);
		}
	}

	var result = {
		logLevels: logger.getLogLevels(),
		config: channelConfig
	};

	state.respond(result);

	cb();
};

