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

		if (!log.additionalData) {
			log.additionalData = {
				pid : process.pid
			};
		} else {
            var dataEntry, additionalData = {'pid' : pid};

            for (var key in log.additionalData) {
                dataEntry = log.additionalData[key];

                if (typeof(dataEntry) === 'string') {
                    additionalData[key] = dataEntry;
                    continue;
                }

                for (var subkey in dataEntry) {
                    additionalData[key + '_' + subkey] = dataEntry[subkey];
                }
            }

            log.additionalData = additionalData;
		}

		logger[channel](log.shortMessage, log.fullMessage.join('\n'), log.additionalData, log.timestamp);
	};
};

module.exports = GraylogWriter;
