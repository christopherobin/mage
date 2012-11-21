// ChannelMap is a structure that contains a list of channels. On every dependency, a reference
// count is incremented, so we can easily keep track of the need for a channel. Once a counter hits
// 0, the channel should be disabled on the LogCreator instances that depend on this ChannelMap.

var util = require('util');
var EventEmitter = require('events').EventEmitter;


function ChannelMap() {
	EventEmitter.call(this);

	this._usages = {};
}


util.inherits(ChannelMap, EventEmitter);


ChannelMap.prototype.getChannels = function () {
	return this._usages;
};


ChannelMap.prototype.add = function (name) {
	if (this._usages.hasOwnProperty(name)) {
		return false;
	}

	this._usages[name] = 0;

	this.emit('created', name);

	return true;
};


ChannelMap.prototype.isActive = function (name) {
	return this._usages[name] > 0;
};


ChannelMap.prototype.enable = function (name) {
	var count = this._usages[name];

	if (typeof count !== 'number') {
		return;
	}

	if (count === 0) {
		this.emit('enabled', name);
	}

	count += 1;

	this._usages[name] = count;
};


ChannelMap.prototype.disable = function (name) {
	var count = this._usages[name];

	if (typeof count !== 'number') {
		return;
	}

	count -= 1;

	if (count === 0) {
		this.emit('disabled', name);
	}

	this._usages[name] = count;
};


exports.ChannelMap = ChannelMap;
