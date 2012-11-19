function Writer() {
}


Writer.prototype.setLogCreator = function (logCreator) {
	this.logCreator = logCreator;
};


Writer.prototype.reconfigureListeners = function (channelNames) {
	// channelNames = ['debug', 'error', ...]

	var channelName, i, len, handler;
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

		if (!this.handlers[channelName]) {
			// channel got added

			handler = this.channelFunctionGenerator(channelName);

			this.handlers[channelName] = handler;

			queue.on(channelName, handler);

			channelMap.enable(channelName);
		}
	}
};

module.exports = Writer;
