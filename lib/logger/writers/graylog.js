var util   = require('util'),
	writer = require('./writer'),
	client = require('graylog2');

function GraylogWriter(cfg, parser) {
	this.parser = parser;
	this.client = new client.graylog(cfg);
}

util.inherits(GraylogWriter, writer.writer);

GraylogWriter.prototype.channelFunctionGenerator = function (channel) {
	if (!this.client[channel]) {
		return function () {
			return true;
		};
	}

	var logger = this.client;
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

module.exports = GraylogWriter;
