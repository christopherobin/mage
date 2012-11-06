var util   = require('util'),
	writer = require('./writer'),
	client = require('loggly');

function LogglyWriter(cfg, parser) {

	cfg.json = true;

	this.parser = parser;
	this.token	= cfg.token;
	this.client = client.createClient(cfg);
}

util.inherits(LogglyWriter, writer.writer);

LogglyWriter.prototype.channelFunctionGenerator = function (channel) {

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

module.exports = LogglyWriter;
