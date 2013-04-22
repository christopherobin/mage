var mage = require('../../../mage');
var loggingService = mage.core.loggingService;


exports.access = 'anonymous';

exports.params = [];

exports.execute = function (state, cb) {
	var config = mage.core.config.get('logging.html5', {
		"console": {
			"channels": [">=verbose"]
		},
		"server": {
			"channels": [">=verbose"]
		}
	});

	var channelConfig = {};

	for (var writerType in config) {
		var writerConfig = config[writerType];

		if (writerConfig && writerConfig.channels) {
			channelConfig[writerType] = loggingService.parseChannelList(writerConfig.channels);
		}
	}

	// You must set disableOverride to true in both your client and server
	// sections to disable the console override in the browser.

	var disableOverride = true;

	for (var channelName in config) {
		var channel = config[channelName];
		if (channel.config && !channel.config.disableOverride) {
			disableOverride = false;
			break;
		}
	}

	var result = {
		logLevels: loggingService.getLogLevels(),
		config: channelConfig,
		disableOverride: disableOverride
	};

	state.respond(result);

	cb();
};
