var events = require('events');
var writer = new events.EventEmitter();

writer.prototype = events.EventEmitter.prototype;

writer.prototype.reconfigureListeners = function (channels) {

	var ch, c;

	for (c in this.channels) {
		ch = this.channels[c];
		this.parser.removeListener(ch, this[ch]);
	}

	var channel;
	this.channels = channels;

	for (c in channels) {
		channel = channels[c];
		this[channel] = this.channelFunctionGenerator(channel);
		this.parser.on(channel, this[channel]);
	}

	this.emit('newChannelList', channels);
};

exports.writer = writer;
