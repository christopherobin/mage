var util = require('util'),
    Writer = require('../writer'),
    client = require('loggly');

function LogglyWriter(cfg) {
	Writer.call(this);

	cfg.json = true;

	this.token = cfg.token;
	this.client = client.createClient(cfg);
}

util.inherits(LogglyWriter, Writer);


LogglyWriter.prototype.channelFunctionGenerator = function () {
	var token = this.token;
	var logglyClient = this.client;

	return function (entry) {
		logglyClient.log(token, entry);
	};
};

module.exports = LogglyWriter;
