var util	= require('util');

var allDefaultLogChannels = [
	'time',
    'mithril_debug',
	'debug',
	'info',
	'notice',
	'warning',
	'error',
	'critical',
	'alert',
	'emergency',
];

var parser = new (require('./parser')).Parser();

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

exports.existingChannels = {
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
        exports.emergency('Logger type', type, 'is not available');
		return;
	}

	if (!exports.writers[type]) {
		exports.writers[type] = new exports.writerClasses[type](cfg, parser);
		exports.writers[type].on('newChannelList', function (channels) {

			var existingChannelPos = -1,
				channel;

			for (var c in channels) {

				channel = channels[c];

				_setChannelFunction(channel);

				if (!exports.existingChannels[channel]) {
					exports.existingChannels[channel] = [];
				}

				if (exports.existingChannels[channel].indexOf(type) === -1) {
					exports.existingChannels[channel].push(type);
				}
			}

			for (var sc in exports.existingChannels) {

				existingChannelPos = exports.existingChannels[sc].indexOf(type);

				if (existingChannelPos > -1 && channels.indexOf(sc) === -1) {
					exports.existingChannels[sc].splice(existingChannelPos, 1);

					if (exports.existingChannels[sc].length === 0) {
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

exports.has = function (channel) {
    return !!exports[channel];
};

// Add a default writer - this gets overriden after first configuration
exports.addWriter('terminal', allDefaultLogChannels, null);
