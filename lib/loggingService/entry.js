// The LogEntry class represents a single log entry.
// It is the thing that gets emitted each time a user logs something, and contains an efficient
// API for passing context, details and data.

var cluster = require('cluster');
var util = require('util');

var IncomingMessage = require('http').IncomingMessage;


function serializeAny(obj, refList) {
	var out;

	refList = refList || [];

	if (Array.isArray(obj)) {
		if (refList.indexOf(obj) !== -1) {
			return '[Circular reference]';
		}

		refList.push(obj);

		var len = obj.length;

		out = new Array(len);

		for (var i = 0; i < len; i++) {
			out[i] = serializeAny(obj[i], refList);
		}

		return out;
	}

	if (obj && typeof obj === 'object') {
		if (refList.indexOf(obj) !== -1) {
			return '[Circular reference]';
		}

		refList.push(obj);

		// class: Buffer

		if (Buffer.isBuffer(obj)) {
			return '[Buffer (' + obj.length + ' bytes)]';
		}

		// class: IncomingMessage (incoming http requests and responses to outgoing http requests)

		if (obj instanceof IncomingMessage) {
			obj = {
				httpVersion: obj.httpVersion,
				method: obj.method,
				url: obj.url,
				headers: obj.headers,
				remoteAddress: obj.connection && obj.connection.remoteAddress
			};
		}

		// normal object

		out = {};

		for (var key in obj) {
			if (obj.hasOwnProperty(key)) {
				out[key] = serializeAny(obj[key], refList);
			}
		}

		return out;
	}

	// scalar

	return obj;
}


function LogEntry(channel) {
	this.timestamp = new Date();
	this.pid = process.pid;
	this.role = cluster.isMaster ? 'm' : 'w';
	this.channel = channel;
	this.contexts = null;
	this.message = null;
	this.details = null;
	this.data = null;
}


LogEntry.prototype.registerErrorDetails = function (error) {
	// the stack trace will become the full message

	// turn the stack string into an array, stripped from its noisy whitespace

	var stack = error.stack && error.stack.split(/\s*\n\s*at\s+/);
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


LogEntry.prototype.serializeArgument = function (arg) {
	if (arg instanceof Error) {
		this.registerErrorDetails(arg);

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
};


LogEntry.prototype.serializeArguments = function (args) {
	var str;

	for (var i = 0, len = args.length; i < len; i++) {
		var arg = this.serializeArgument(args[i]);

		if (str) {
			str += ' ' + arg;
		} else {
			str = arg;
		}
	}

	return str;
};


LogEntry.prototype.addMessageArgs = function (args) {
	var str = this.serializeArguments(args);

	if (this.message) {
		this.message += ' ' + str;
	} else {
		this.message = str;
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
	var str = this.serializeArguments(args);

	if (this.details) {
		this.details.push(str);
	} else {
		this.details = [str];
	}
};


LogEntry.prototype.addData = function (data) {
	data = serializeAny(data);

	if (this.data) {
		for (var key in data) {
			if (data.hasOwnProperty(key)) {
				this.data[key] = data[key];
			}
		}
	} else {
		this.data = data;
	}
};


exports.LogEntry = LogEntry;
