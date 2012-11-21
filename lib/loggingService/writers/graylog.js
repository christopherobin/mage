var util   = require('util'),
	Writer = require('../writer'),
	client = require('graylog2');


function GraylogWriter(cfg) {
	Writer.call(this);

	this.client = new client.graylog(cfg);
}


util.inherits(GraylogWriter, Writer);


GraylogWriter.prototype.channelFunctionGenerator = function (channel) {
	var client = this.client;

	if (!client[channel]) {
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


	return function (entry) {
		var data = {};

		// serialize the data object into a flattened map

		serializeData(data, [], entry.data);

		// add the PID

		data.pid = process.pid;

		// log to graylog

		client[channel](entry.message, entry.details ? entry.details.join('\n') : '', data, entry.timestamp);
	};
};

module.exports = GraylogWriter;
