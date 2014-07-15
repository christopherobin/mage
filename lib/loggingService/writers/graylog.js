var util = require('util');
var requirePeer = require('codependency').get('mage');
var Writer = require('../Writer');
var Graylog = requirePeer('graylog2').graylog;


function GraylogWriter(cfg) {
	Writer.call(this);

	this.client = new Graylog(cfg);

	this.client.on('error', function (error) {
		console.error('Graylog writer experienced an error:', error);
	});
}


util.inherits(GraylogWriter, Writer);


GraylogWriter.prototype.destroy = function (cb) {
	// Allow the graylog client some breathing space to drain.
	// Obviously, this implementation is *far* from ideal. We should really become able to wait
	// for the graylog client socket to be drained through a callback.

	var that = this;

	Writer.prototype.destroy.call(this, function () {
		//
		// Have we closed yet?
		//
		var isClosed = false;

		//
		// Try to close gracefully
		//
		that.client.close(function () {
			if (!isClosed) {
				isClosed = true;
				cb();
			}
		});

		//
		// Hard-kill after half a second
		//
		setTimeout(function () {
			if (!isClosed) {
				isClosed = true;
				that.client.destroy();
				cb();
			}
		}, 500);
	});
};


GraylogWriter.prototype.supportsChannel = function (channelName) {
	return !!this.client[channelName];
};


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
