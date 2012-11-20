var util   = require('util'),
	Writer = require('./writer'),
	client = require('graylog2');

function GraylogWriter(cfg) {
	this.client = new client.graylog(cfg);
}

util.inherits(GraylogWriter, Writer);


GraylogWriter.prototype.channelFunctionGenerator = function (channel) {
	var graylogClient = this.client;

	if (!graylogClient[channel]) {
		return function () {};
	}


	function serializeData(data, prefix, value) {
		if (value && (typeof value === 'object' || Array.isArray(value))) {
			for (var key in value) {
				serializeData(data, prefix.concat(key), value[key]);
			}
		} else {
			data[prefix.join('_')] = value;
		}
	}


	var pidData = { pid: process.pid };

	return function (entry) {
		entry.addData(pidData);

		// graylog only allows one level of nesting (TODO: confirm)

		var data = {};

		serializeData(data, [], entry.data);

		graylogClient[channel](entry.message, entry.details ? entry.details.join('\n') : '', data, entry.timestamp);
	};
};

module.exports = GraylogWriter;
