var mage = require('../../../mage');
var loggingService = mage.core.loggingService;

exports.access = 'admin';

exports.params = [];

exports.execute = function (state, cb) {
	var channelNames = loggingService.getAllChannelNames();

	state.respond(channelNames);
	cb();
};