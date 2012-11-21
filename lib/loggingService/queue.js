// The LogQueue is a simple container that holds up to 1 LogEntry.
//
// The reason we need a queue system, is because the logging service allows for log-chaining, like:
//   logger.error('some message').data({ beep: 'boop' });
//
// There is no terminating statement, and so we rely on process.nextTick to provide us with a
// termination point. If however in the current tick a new LogEntry is created, we also know that
// the previous one has terminated and can be delivered.
//
// Delivery happens through event emission, where the name of the channel is the event name.

var util = require('util');
var EventEmitter = require('events').EventEmitter;


function LogQueue() {
	EventEmitter.call(this);

	this.queued = null;
}


util.inherits(LogQueue, EventEmitter);


LogQueue.prototype.add = function (entry) {
	if (this.queued) {
		// Something is already queued.
		// That means we can now conclude that the previously queued entry has completed and
		// can be sent off. It also means that the previous entry caused nextTick to be set up.
		// There is therefore no need to set it up again for this new entry.

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
