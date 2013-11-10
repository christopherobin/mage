var msgServer = require('mage').msgServer;
var EventEmitter = require('emitter');

var logLevels = {};

var logger = new EventEmitter();

var ErrorEvent = window.ErrorEvent;


// make safe copies of console log methods

var consoleLogChannels = {
	log: 'debug',
	debug: 'debug',
	info: 'notice',
	warn: 'warning',
	error: 'error'
};

Object.keys(consoleLogChannels).forEach(function (methodName) {
	if (typeof console[methodName] === 'function') {
		console['_' + methodName] = console[methodName];
	}
});


function serializeError(error) {
	return {
		name: error.name,
		message: error.message,
		fileName: error.fileName,
		lineNumber: error.lineNumber,
		stack: typeof error.stack === 'string' ? error.stack.split('\n') : error.stack
	};
}


function jsonSerialize(arg) {
	var RegExp = window.RegExp;
	var Node = window.Node;
	var Window = window.Window;

	try {
		return JSON.stringify(arg);
	} catch (e) {
		// continue and deal with circular references
	}

	// serialize(obj) will turn obj into a JSON representation

	var reflist = [];

	function serialize(obj) {
		if (obj === undefined) {
			obj = '<undefined>';
		}

		// class: Window

		if (Window && obj instanceof Window) {
			obj = '[DOM Window]';
		}

		// class: Node (dom elements, etc, cannot be serialized without hazard)

		if (Node && obj instanceof Node) {
			obj = '[DOM Node (' + obj.nodeName + ')]';
		}

		// class: RegExp

		if (RegExp && obj instanceof RegExp) {
			// turn into a string

			obj = '[RegExp (' + obj.toString() + ')]';
		}

		if (Array.isArray(obj)) {
			// array

			if (reflist.indexOf(obj) !== -1) {
				return '"[Circular reference]"';
			}

			reflist.push(obj);

			return '[' + obj.map(serialize).join(',') + ']';
		}

		if (obj && typeof obj === 'object') {
			// object

			if (reflist.indexOf(obj) !== -1) {
				return '"[Circular reference]"';
			}

			reflist.push(obj);

			var keys = Object.keys(obj);

			return '{' + keys.map(function (key) {
				return JSON.stringify(key) + ':' + serialize(obj[key]);
			}).join(',') + '}';
		}

		// scalar

		return JSON.stringify(obj);
	}

	return serialize(arg);
}


function serializeArgument(arg, data) {
	if (arg === undefined) {
		return 'undefined';
	}

	if (typeof arg === 'string') {
		return arg;
	}

	if (arg instanceof Error) {
		data.error = serializeError(arg);

		return arg.name + ': ' + arg.message;
	}

	if (ErrorEvent && arg instanceof ErrorEvent) {
		// ErrorEvent has "filename", "lineno", "message" and possibly "column"/"colno" and "error"
		//
		// The w3c says "column" and has no "error" property.
		// The whatwg says "colno" and adds the "error" property, which is the thrown object.
		//
		// For more information about the insanity, read the two different specifications at:
		//
		// - http://www.whatwg.org/specs/web-apps/current-work/multipage/webappapis.html#the-errorevent-interface
		// - http://www.w3.org/TR/html5/webappapis.html#the-errorevent-interface
		// - https://developer.mozilla.org/en-US/docs/Web/API/ErrorEvent

		data.filename = arg.filename;
		data.lineno = arg.lineno;
		data.colno = arg.colno || arg.column;

		if (arg.error && arg.error instanceof Error) {
			data.error = serializeError(arg.error);
		}

		return arg.message;
	}

	return jsonSerialize(arg);
}


function serializeArguments(args) {
	var len = args.length;
	var out = new Array(len);
	var data = {};

	for (var i = 0; i < len; i++) {
		out[i] = serializeArgument(args[i], data);
	}

	var message = out.join(' ');

	if (Object.keys(data).length === 0) {
		data = null;
	}

	return { message: message, data: data };
}


function setChannelFunction(channelName) {
	if (logger[channelName]) {
		// already set
		return;
	}

	logger[channelName] = function log() {
		logger.emit(channelName, arguments);
	};
}


// Writer classes
// --------------

// Console

function ConsoleWriter() {
}


ConsoleWriter.prototype.addChannel = function (channelName) {
	var slice = Array.prototype.slice;
	var prefix = ['[' + channelName + ']'];
	var logLevel = logLevels[channelName] || 0;
	var fn;

	if (logLevel > logLevels.warning) {
		fn = console._error;
	}

	if (!fn && logLevel >= logLevels.notice) {
		fn = console._warn;
	}

	if (!fn) {
		fn = console._log;
	}

	logger.on(channelName, function writeToConsole(args) {
		args = prefix.concat(slice.call(args));

		fn.apply(console, args);
	});
};


// Server

function ServerWriter() {
}

ServerWriter.prototype.addChannel = function (channelName) {
	if (!logger.hasOwnProperty('sendReport')) {
		console._error('logger.sendReport usercommand is not exposed.', channelName);
		return;
	}

	var ignoreIncoming = false;

	// calculate browser info

	var nav = window.navigator || {};

	var clientInfo = {
		userAgent: nav.userAgent || 'unknown'
	};

	logger.on(channelName, function (args) {
		if (ignoreIncoming) {
			// don't log that a sendReport failed because of network conditions, it's overkill.
			return;
		}

		var report = serializeArguments(args);

		if (!report.data) {
			report.data = {};
		}

		report.data.clientInfo = clientInfo;

		msgServer.queue(function () {
			ignoreIncoming = true;

			logger.sendReport('html5', channelName, report.message, report.data, function (error) {
				if (error) {
					console._error('Could not forward logs to remote server');
				}

				ignoreIncoming = false;
			});
		});
	});
};


var writerClasses = {
	console: ConsoleWriter,
	server: ServerWriter
};


var writers = {};

function getOrCreateWriter(writerType) {
	var writer = writers[writerType];

	if (writer) {
		return writer;
	}

	var WriterClass = writerClasses[writerType];

	if (!WriterClass) {
		console.error('Unknown writer type:', writerType);
		return;
	}

	writer = new WriterClass();

	writers[writerType] = writer;

	return writer;
}


function setupChannels(config) {
	var allChannelNames = Object.keys(logLevels);

	for (var i = 0, len = allChannelNames.length; i < len; i++) {
		var channelName = allChannelNames[i];

		// make sure events are emitted for this channel

		setChannelFunction(channelName);

		// if there are any writers that care about this channel, make them listen for it

		for (var writerType in config) {
			var writerChannels = config[writerType];
			var writer = getOrCreateWriter(writerType);

			if (writer && writerChannels.indexOf(channelName) !== -1) {
				writer.addChannel(channelName);
			}
		}
	}
}


logger.setup = function (cb) {
	if (!logger.hasOwnProperty('sync')) {
		return cb('Could not sync: logger.sync is not exposed.');
	}

	logger.sync(function (error, data) {
		if (error) {
			return cb(error);
		}

		if (!data) {
			return cb();
		}

		logLevels = data.logLevels;

		setupChannels(data.config);

		if (!data.disableOverride) {
			logger.overrideConsole();
			logger.logUncaughtExceptions('error', false);
		}

		cb();
	});
};


logger.overrideConsole = function () {
	Object.keys(consoleLogChannels).forEach(function (methodName) {
		var channelName = consoleLogChannels[methodName];

		console[methodName] = function readFromConsole() {
			logger.emit(channelName, arguments);
		};
	});
};


logger.logUncaughtExceptions = function (channelName, continueErrorFlow) {
	// be aware: not all browsers implement column and error

	if (window.onerror) {
		logger.debug('window.onerror was already assigned, overwriting.');
	}

	window.onerror = function (message, url, lineno, colno, error) {
		// the ErrorEvent object that is not passed to this function, but lives on window gives us
		// the most information but not all browsers support it

		var event = window.event;

		if (ErrorEvent && event instanceof ErrorEvent) {
			logger.emit(channelName, [window.event]);
		} else {
			// create our own ErrorEvent-like object
			// note: colno is not passed by older browsers

			var args = [{
				message: message,
				url: url,
				lineno: lineno,
				colno: colno
			}];

			// modern browsers will add the thrown error object as the 5th argument

			if (error) {
				args.push(error);
			}

			logger.emit(channelName, args);
		}

		if (!continueErrorFlow) {
			// this doesn't work when using addEventListener instead of direct assignment to onerror
			return true;
		}
	};
};


module.exports = logger;