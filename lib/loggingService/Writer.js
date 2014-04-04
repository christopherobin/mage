// Writer is the super class for specific Writer types.
//
// Specific writer classes have been implemented for several services, including the obvious
// file and terminal. The Writer super class is in charge of asking the child classes to provide
// functions per relevant channel, and hooking them up to the ChannelMap's event emission.

function Writer() {
	this.handlers = {}; // key: channelName, value: event listener
}


Writer.prototype.setLogCreator = function (logCreator) {
	this.logCreator = logCreator;
};


Writer.prototype.destroy = function (cb) {
	this.reconfigureListeners([]);
	process.nextTick(cb);
};


Writer.prototype.reconfigureListeners = function (channelNames) {
	// channelNames = ['debug', 'error', ...]

	var channelName, i, len, handler, existingHandler;
	var channelMap = this.logCreator.getChannelMap();

	if (!channelMap) {
		return;
	}

	// unregister all existing event listeners for this writer that have not been mentioned
	// in the passed channelNames

	for (channelName in this.handlers) {
		if (channelNames.indexOf(channelName) === -1) {
			// channel got removed

			handler = this.handlers[channelName];

			channelMap.removeListener(channelName, handler);
		}
	}

	// given the new channels, register event listeners

	for (i = 0, len = channelNames.length; i < len; i++) {
		channelName = channelNames[i];
		existingHandler = this.handlers[channelName];

		// configuration may change, so even if the channel was already being handled,
		// we need to replace it

		// set up the new event handler

		handler = this.channelFunctionGenerator(channelName);

		this.handlers[channelName] = handler;

		channelMap.on(channelName, handler);

		// remove the existing handler if there was one

		if (existingHandler) {
			// remove the old listener

			channelMap.removeListener(channelName, existingHandler);
		}
	}
};

module.exports = Writer;
