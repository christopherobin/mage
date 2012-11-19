// LogCreator creates LogReceiver objects which can in turn receive details and data, and deal with the delivery

var util = require('util');
var EventEmitter = require('events').EventEmitter;


function LogQueue() {
	EventEmitter.call(this);

	this.queued = null;
}


util.inherits(LogQueue, EventEmitter);


LogQueue.prototype.add = function (entry) {
	if (this.queued) {
		// something is queued, so nextTick will fire
		// there is no need to set it up again

		this.send();
	} else {
		var that = this;

		process.nextTick(function () {
			that.send();
		});
	}

	this.queued = entry;
};


LogQueue.prototype.send = function () {
	if (this.queued) {
		// NOTE OF CAUTION: emitting "error" will throw an exception in node.js if not listened for

		this.emit(this.queued.channel, this.queued);

		this.queued = null;
	}
};


exports.LogQueue = LogQueue;
