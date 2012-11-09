var EventEmitter = require('events').EventEmitter;
var util = require('util');


function Writer() {
}


util.inherits(Writer, EventEmitter);


Writer.prototype.reconfigureListeners = function (channelNames) {
	// channelNames = ['debug', 'error', ...]

	var channelName, i, len, handler;

	if (!this.parser) {
		return;
	}

	// unregister all existing event listeners for this writer on the parser

	if (this.handlers) {
		for (channelName in this.handlers) {
			handler = this.handlers[channelName];

			this.parser.removeListener(channelName, handler);
		}
	}

	// reset the list of handlers

	this.handlers = {}; // key: channelName, value: event listener

	// given the new channels, register event listeners on the parser

	for (i = 0, len = channelNames.length; i < len; i++) {
		channelName = channelNames[i];

		handler = this.channelFunctionGenerator(channelName);

		this.handlers[channelName] = handler;

		this.parser.on(channelName, handler);
	}

	this.emit('newChannelList', channelNames);
};

module.exports = Writer;
