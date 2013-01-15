var mage = require('../../../mage');
var loggingService = mage.core.loggingService;


exports.params = [];

exports.execute = function (state, cb) {
	var config = mage.core.config.get('logging.html5');
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
