// LogCreator creates LogReceiver objects which can in turn receive details and data, and deal with the delivery

var LogReceiver = require('./receiver').LogReceiver;


var decoy = new LogReceiver();

function deliverDecoy() {
	return decoy;
}


function LogCreator(queue, channelMap) {
	// carries the channels and the base-context setup
	// the channel functions return a decoy, or a newly created LogReceiver

	this._queue = queue;
	this._contexts = [];
	this._setChannelMap(channelMap);
}


LogCreator.prototype.getQueue = function () {
	return this._queue;
};


LogCreator.prototype.getChannelMap = function () {
	return this._channelMap;
};


LogCreator.prototype._setChannelMap = function (channelMap) {
	// store channelMap for future clones

	this._channelMap = channelMap;

	// apply channelMap

	var channels = channelMap.getChannels();

	for (var channelName in channels) {
		var enabled = channels[channelName];

		if (enabled) {
			this.createChannelHandler(channelName);
		} else {
			this.createChannelDecoy(channelName);
		}
	}

	// when the channelMap enables or disables a channel, we should set up a handler or decoy again

	var that = this;

	channelMap.on('created', function (channelName) {
		that.createChannelDecoy(channelName);
	});

	channelMap.on('disabled', function (channelName) {
		that.createChannelDecoy(channelName);
	});

	channelMap.on('enabled', function (channelName) {
		that.createChannelHandler(channelName);
	});
};


LogCreator.prototype.addContexts = function () {
	this._contexts.push.apply(this._contexts, arguments);
};


LogCreator.prototype.context = function () {
	// clones self and augments with context

	var clone = new LogCreator(this._queue, this._channelMap);

	clone.addContexts.apply(clone, arguments);

	return clone;
};


LogCreator.prototype.createChannelHandler = function (channelName) {
	var contexts = this._contexts;
	var queue = this._queue;

	this[channelName] = function () {
		return new LogReceiver(queue, channelName, contexts.length > 0 ? contexts.slice() : null, arguments);
	};
};


LogCreator.prototype.createChannelDecoy = function (channelName) {
	this[channelName] = deliverDecoy;
};


exports.LogCreator = LogCreator;
