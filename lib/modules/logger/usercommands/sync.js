var mithril = require('../../../mithril');
var loggingService = mithril.core.loggingService;


exports.params = [];

exports.execute = function (state, cb) {
	var config = mithril.core.config.get('logging.html5');
	var channelConfig = {};

	for (var writerType in config) {
		var writerConfig = config[writerType];

		if (writerConfig && writerConfig.channels) {
			channelConfig[writerType] = loggingService.parseChannelList(writerConfig.channels);
		}
	}

	var result = {
		logLevels: loggingService.getLogLevels(),
		config: channelConfig
	};

	state.respond(result);

	cb();
};
