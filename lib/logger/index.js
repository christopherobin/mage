var util	= require('util');

var allDefaultLogChannels = [
	'time',
	'debug',
	'info',
	'notice',
	'warning',
	'error',
	'critical',
	'alert',
	'emergency',
];

var seenChannels = {
	// format: "channel": ['file', 'terminal']
};

var parser = new (require('./parser')).parser();

var used = {};

var _setChannelFunction = function (channel) {
	exports[channel] = function () {
		return parser.setChannel(channel)
						.log
						.apply(parser, arguments);
	};
};

var _unsetChannelFunction = function (channel) {
	exports[channel] = function () {
		return parser.decoy();
	};
};

var _parseChannelList = function (channels) {

	if (!channels) {
		return [];
	}

	var ret = [],
		channel,
		offset;

	for (var c in channels) {
		channel = channels[c];
		offset = 1;

		if (channel[0] === '>') {
			if (channel[1] === '=') {
				offset = 0;
				channel = channel.substr(2);
			}
			else {
				channel = channel.substr(1);
			}

			ret = ret.concat(
				allDefaultLogChannels.slice(
					allDefaultLogChannels.indexOf(channel) + offset
				)
			);

			continue;
		}
		if (channel[0] === '<') {
			if (channel[1] === '=') {
				offset = 0;
				channel = channel.substr(2);
			}
			else {
				channel = channel.substr(1);
			}

			ret = ret.concat(
				allDefaultLogChannels.slice(0, allDefaultLogChannels.indexOf(channel) - offset)
			);

			continue;
		}
		else {
			ret.push(channel);
		}
	}

	return ret;
};

exports.writerClasses = {
	file     : require('./writers/file'),
	terminal : require('./writers/terminal'),
	graylog  : require('./writers/graylog'),
	socket   : require('./writers/socket'),
	loggly   : require('./writers/loggly')
};

exports.writers = [];

exports.configure = function (cfg) {
	for (var type in cfg) {
		exports.addWriter(type, cfg[type].channels, cfg[type].config);
	}
};

exports.addWriter = function (type, channels, cfg) {
	if (!exports.writerClasses[type]) {
		return; // erm, something should be done here...
	}

	if (!exports.writers[type]) {
		exports.writers[type] = new exports.writerClasses[type](cfg, parser);
		exports.writers[type].on('newChannelList', function (channels) {

			var seenChannelPos = -1,
				channel;

			for (var c in channels) {

				channel = channels[c];

				_setChannelFunction(channel);

				if (!seenChannels[channel]) {
					seenChannels[channel] = [];
				}

				if (seenChannels[channel].indexOf(type) === -1) {
					seenChannels[channel].push(type);
				}
			}

			for (var sc in seenChannels) {

				seenChannelPos = seenChannels[sc].indexOf(type);

				if (seenChannelPos > -1 && channels.indexOf(sc) === -1) {
					seenChannels[sc].splice(seenChannelPos, 1);

					if (seenChannels[sc].length === 0) {
						_unsetChannelFunction(sc);
					}
				}
			}
		});
	}
	else if (cfg) {
		if (exports.writers[type].reconfigure) {
			exports.writers[type].reconfigure(cfg);
		}
		else {
			exports.error('Trying to reconfigure', type, 'but no reconfigure prototype function available');
		}
	}

	exports.writers[type].reconfigureListeners(_parseChannelList(channels));
};

exports.addWriterType = function (typeName, typeClass) {
	exports.writerClasses[typeName] = typeClass;
};

global.logError = function () {
    if (exports.error) {
        return exports.error.apply(exports, arguments);
    }

    console.error.apply(arguments);
};

// Add a default writer - this gets overriden after first configuration
exports.addWriter('terminal', allDefaultLogChannels, null);
