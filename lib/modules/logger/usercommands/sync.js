var mage = require('../../../mage');
var loggingService = mage.core.loggingService;


var clientConfig;

function getClientConfig() {
	if (clientConfig) {
		return clientConfig;
	}

	var config = mage.core.config.get(['logging', 'html5'], {
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

	// You must set disableOverride to true in both the console and server
	// sections of html5 to disable the console override and uncaught exception handling in the
	// browser.

	var disableOverride = true;

	for (var writerName in config) {
		var writer = config[writerName];
		if (!writer.disableOverride) {
			disableOverride = false;
			break;
		}
	}

	clientConfig = {
		logLevels: loggingService.getLogLevels(),
		config: channelConfig,
		disableOverride: disableOverride
	};

	return clientConfig;
}


exports.access = 'anonymous';

exports.params = [];

exports.execute = function (state, cb) {
	state.respond(getClientConfig());

	cb();
};
