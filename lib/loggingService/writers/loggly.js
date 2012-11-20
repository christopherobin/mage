var util   = require('util'),
	Writer = require('./writer'),
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
	var pidData = { pid: process.pid };

	return function (entry) {
		entry.addData(pidData);

		logglyClient.log(token, entry);
	};
};

module.exports = LogglyWriter;
