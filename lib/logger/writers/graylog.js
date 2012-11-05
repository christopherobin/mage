var util   = require('util'),
	writer = require('./writer'),
	graylog = require('graylog2');

var gl = function (cfg, parser) {
	this.parser = parser;
	this.graylog = new graylog.graylog(cfg);
};

util.inherits(gl, writer.writer);

gl.prototype.channelFunctionGenerator = function (channel) {
	if (!this.graylog[channel]) {
		return function () {
			return true;
		};
	}

	var logger = this.graylog;
	var pid    = process.pid;

	return function (log) {

		if (!log.additional_data) {
			log.additional_data = {
				pid : process.pid
			};
		} else {
            var dataEntry, additional_data = {'pid' : pid};

            for (var key in log.additional_data) {
                dataEntry = log.additional_data[key];

                if (typeof(dataEntry) === 'string') {
                    additional_data[key] = dataEntry;
                    continue;
                }

                for (var subkey in dataEntry) {
                    additional_data[key + '_' + subkey] = dataEntry[subkey];
                }
            }

            log.additional_data = additional_data;
		}

		logger[channel](log.short_message, log.full_message.join('\n'), log.additional_data, log.timestamp);
	};
};

module.exports = gl;
