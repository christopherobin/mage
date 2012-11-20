var util = require('util');


function serializeArgument(arg) {
	if (arg instanceof Error) {
		arg = arg.message;
	}

	if (arg === undefined) {
		return 'undefined';
	}

	if (typeof arg === 'string') {
		return arg;
	}

	// object stringification

	try {
		return JSON.stringify(arg);	// may fail because of circular references
	} catch (e) {
		return util.inspect(arg);   // yields multiline strings, much more readable than JSON for stack traces etc...
	}
}


function serializeArguments(args) {
	var len = args.length;
	var out = new Array(len);

	for (var i = 0; i < len; i++) {
		out[i] = serializeArgument(args[i]);
	}

	return out.join(' ');
}


function deepCopy(obj) {
	var out;

	if (Array.isArray(obj)) {
		var len = obj.length;

		out = new Array(len);

		for (var i = 0; i < len; i++) {
			out[i] = deepCopy(obj[i]);
		}
	} else if (obj && typeof obj === 'object') {
		out = {};

		for (var key in obj) {
			out[key] = deepCopy(obj[key]);
		}
	} else {
		out = obj;
	}

	return out;
}


var pid = process.pid;

function LogEntry(queue, channel, contexts, message) {
	this.timestamp = new Date();
	this.pid = pid;
	this.channel = channel;
	this.contexts = contexts;
	this.message = serializeArguments(message);
	this.details = null;
	this.data = null;

	if (message[0] instanceof Error) {
		this.parseError(message[0]);
	}

	queue.add(this);
}


LogEntry.prototype.parseError = function (error) {
	// the stack trace will become the full message

	// turn the stack string into an array, stripped from its noisy whitespace

	var stack = error.stack.split(/\s*\n\s*at\s+/);
	if (stack && stack.length > 1) {
		// remove the first line: "Error: name", leaving only stack frames

		stack.shift();

		// write the fullMessage string

		this.details = stack;

		// the error type (usually "Error"), file, line and character offset will become the data

		var m = stack[0].match(/([\w\.]+):([0-9]+):([0-9]+)/);
		if (m) {
			var fileName = m[1];
			var line = parseInt(m[2], 10) || 0;
			var offset = parseInt(m[3], 10) || 0;

			this.data = {
				type: error.name,
				file: fileName,
				line: line,
				offset: offset
			};
		}
	}
};


LogEntry.prototype.addContexts = function (args) {
	if (this.contexts) {
		this.contexts.push.apply(this.contexts, args);
	} else {
		this.contexts = Array.prototype.slice.call(args);
	}
};


LogEntry.prototype.addDetails = function (args) {
	args = serializeArguments(args);

	if (this.details) {
		this.details.push(args);
	} else {
		this.details = [args];
	}
};


LogEntry.prototype.addData = function (data) {
	if (this.data) {
		for (var key in data) {
			this.data[key] = deepCopy(data[key]);
		}
	} else {
		this.data = deepCopy(data);
	}
};


exports.LogEntry = LogEntry;
