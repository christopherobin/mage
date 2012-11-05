var util   = require('util'),
	writer = require('./writer'),
	loggly = require('loggly');

var lgly = function (cfg, parser) {

	cfg.json = true;

	this.parser = parser;
	this.token	= cfg.token;
	this.client = loggly.createClient(cfg);
};

util.inherits(lgly, writer.writer);

lgly.prototype.channelFunctionGenerator = function (channel) {

	var logger = this.client;
	var pid    = process.pid;
	var that   = this;

	return function (log) {
		// To finish tomorrow
		if (!log.additional_data) {
			log.additional_data = {
				pid : process.pid
			};
		} else {
			log.additional_data.pid = pid;
		}

		log.channel = channel;
		logger.log(that.token, log);
	};
};

module.exports = lgly;
