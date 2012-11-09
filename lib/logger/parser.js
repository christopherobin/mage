var events = require('events'),
	util   = require('util');

function serializeArguments(args) {
	var len = args.length;
	var out = new Array(len);

	for (var i = 0; i < len; i++) {
		var arg = args[i];

		if (arg === undefined) {
			out[i] = 'undefined';
		} else if (typeof arg === 'string') {
			out[i] = arg;
		} else {
			try {
				out[i] = JSON.stringify(arg);	// may fail because of circular references
			} catch (e) {
				out[i] = util.inspect(arg);		// yields multiline strings, much more readable than JSON for stack traces etc...
			}
		}
	}

	return out.join(' ');
}


function Parser() {
	this.nextTickQueued  = false;
	this.channel = null;
	this._message = null;
	this._fullMessage = [];
	this._additionalData = null;
	this._timestamp = null;
}

util.inherits(Parser, events.EventEmitter);


Parser.prototype.setChannel = function (channel) {
	if (this._message) {
        this.send();
	}

	this.channel = channel;

	return this;
};


Parser.prototype.details = function () {
	if (this._message === null) {
		return;
	}

	this._fullMessage.push(serializeArguments(arguments));

	return this;
};


Parser.prototype.data = function (label, value) {
	if (this._message === null) {
		return;
	}

	if (arguments.length > 1) {
		// a label has been given, so use it to write a single property

		if (!this._additionalData) {
			this._additionalData = {};
		}

		this._additionalData[label] = value;
	} else {
		value = label;

		if (this._additionalData) {
			// there already is data, so augment it

			for (label in value) {
				this._additionalData[label] = value[label];
			}
		} else {
			this._additionalData = value;
		}
	}

	return this;
};


Parser.prototype.log = function (error) {
	// if there is a previous unsent message, send it off now

    if (this._message) {
        this.send();
    }

	this._timestamp = new Date();

	if (error instanceof Error) {
		// short message is error.message

		this._message = error.message;

		// the stack trace will become the full message

		// turn the stack string into an array, stripped from its noisy whitespace

		var stack = error.stack.split(/\s*\n\s*at\s+/);
		if (stack && stack.length > 1) {
			// remove the first line: "Error: name", leaving only stack frames

			stack.shift();

			// write the fullMessage string

			this._fullMessage = stack.join('\n');

			// the error type (usually "Error"), file, line and character offset will become the meta data

			var m = stack[0].match(/([\w\.]+):([0-9]+):([0-9]+)/);
			if (m) {
				var fileName = m[1];
				var line = parseInt(m[2], 10) || 0;
				var offset = parseInt(m[3], 10) || 0;

				this.data({
					type: error.name,
					file: fileName,
					line: line,
					offset: offset
				});
			}
		}
	} else {
		this._message = serializeArguments(arguments);
	}

    if (!this.nextTickQueued) {
		var that = this;

        process.nextTick(function () {
			that.send();
		});

        this.nextTickQueued = true;
    }

	return this;
};


Parser.prototype.send = function () {
    this.nextTickQueued = false;

	// TODO: no need for an object, we can just emit 4 args

	this.emit(this.channel, {
		shortMessage: this._message,
		fullMessage: this._fullMessage,
		additionalData: this._additionalData,
		timestamp: this._timestamp
	});

	// call underlying function

	this.channel = null;
	this._message = null;
	this._timestamp = null;
	this._fullMessage = [];
	this._additionalData = null;
};


Parser.prototype.decoy = function () {
    if (this._message) {
        this.send();
    }

	return this;
};


exports.Parser = Parser;

