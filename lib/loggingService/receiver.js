// LogReceiver objects can receive details and data, and deal with the delivery of LogEntry objects to a LogQueue

var LogEntry = require('./entry').LogEntry;


function LogReceiver(queue, channel, contexts, message) {
	var isDecoy = (arguments.length !== 4);

	this.entry = isDecoy ? null : new LogEntry(queue, channel, contexts, message);
}


LogReceiver.prototype.context = function () {
	if (this.entry) {
		this.entry.addContexts(arguments);
	}

	return this;
};


LogReceiver.prototype.details = function () {
	if (this.entry) {
		this.entry.addDetails(arguments);
	}

	return this;
};


LogReceiver.prototype.data = function (label, value) {
	if (this.entry) {
		var data;

		if (label && typeof label === 'object') {
			data = label;
		} else {
			data = {};
			data[label] = value;
		}

		this.entry.addData(data);
	}

	return this;
};


exports.LogReceiver = LogReceiver;
