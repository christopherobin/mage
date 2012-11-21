// Writer is the super class for specific Writer types.
//
// Specific writer classes have been implemented for several services, including the obvious
// file and terminal. The Writer super class is in charge of asking the child classes to provide
// functions per relevant channel, and hooking them up to a LogQueue's event emission.

var util = require('util');
var EventEmitter = require('events').EventEmitter;


function Writer() {
	EventEmitter.call(this);
}


util.inherits(Writer, EventEmitter);


Writer.prototype.setLogCreator = function (logCreator) {
	this.logCreator = logCreator;
};


Writer.prototype.destroy = function () {
	this.reconfigureListeners([]);
	this.emit('destroy');
};


Writer.prototype.reconfigureListeners = function (channelNames) {
	// channelNames = ['debug', 'error', ...]

	var channelName, i, len, handler, existingHandler;
	var queue = this.logCreator.getQueue();
	var channelMap = this.logCreator.getChannelMap();

	if (!queue || !channelMap) {
		return;
	}

	if (!this.handlers) {
		this.handlers = {}; // key: channelName, value: event listener
	}

	// unregister all existing event listeners for this writer

	for (channelName in this.handlers) {
		if (channelNames.indexOf(channelName) === -1) {
			// channel got removed

			handler = this.handlers[channelName];

			queue.removeListener(channelName, handler);

			channelMap.disable(channelName);
		}
	}

	// given the new channels, register event listeners

	for (i = 0, len = channelNames.length; i < len; i++) {
		channelName = channelNames[i];

		// configuration may change, so even if the channel was already being handled,
		// we need to replace it

		existingHandler = this.handlers[channelName];
		if (existingHandler) {
			// remove the old listener

			queue.removeListener(channelName, existingHandler);
		} else {
			// count a reference on this channel

			channelMap.enable(channelName);
		}

		// set up the new event handler

		handler = this.channelFunctionGenerator(channelName);

		this.handlers[channelName] = handler;

		queue.on(channelName, handler);
	}
};

module.exports = Writer;
