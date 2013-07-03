// ChannelMap is a structure that contains a list of channels. On every dependency, a reference
// count is incremented, so we can easily keep track of the need for a channel. Once a counter hits
// 0, the channel should be disabled on the LogCreator instances that depend on this ChannelMap.

var util = require('util');
var EventEmitter = require('events').EventEmitter;


function ChannelMap() {
	EventEmitter.call(this);

	this._usages = {};

	// many listeners may care for the status of channels, so allow for that

	this.setMaxListeners(0);

	// when the first listener for a channel gets added, it activates the channel

	this.on('newListener', function (channel) {
		// newListener fires before the listener actually got added

		var count = this._usages[channel];

		if (typeof count !== 'number') {
			return;
		}

		if (count === 0) {
			this.emit('channelEnabled', channel);
		}

		count += 1;

		this._usages[channel] = count;
	});

	// when the last listener for a channel gets removed, it deactivates the channel

	this.on('removeListener', function (channel) {
		// removeListener fires after the listener got removed

		var count = this._usages[channel];

		if (typeof count !== 'number') {
			return;
		}

		count -= 1;

		if (count === 0) {
			this.emit('channelDisabled', channel);
		}

		this._usages[channel] = count;
	});
}


util.inherits(ChannelMap, EventEmitter);


ChannelMap.prototype.getChannels = function () {
	return this._usages;
};


ChannelMap.prototype.add = function (channel) {
	if (this._usages.hasOwnProperty(channel)) {
		return false;
	}

	this._usages[channel] = 0;

	this.emit('channelAdded', channel);

	return true;
};


ChannelMap.prototype.isActive = function (name) {
	return this._usages[name] > 0;
};


module.exports = ChannelMap;
