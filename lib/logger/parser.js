var events = require('events'),
	util   = require('util');

function Parser() {
	this.nextTickQueued  = false;
	this.channel         = null;
	this._message        = null;
	this._fullMessage    = [];
	this._additionalData = null;
	this._timestamp      = null;

	this._additionalDataCount = 0;
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

	this._fullMessage.push(this._join(arguments));

	return this;
};

Parser.prototype.data = function (obj, label) {
	if (this._message === null) {
		return;
	}

	if (!this._additionalData) {
		this._additionalData = {};
	}

	if (label) {
		this._additionalData[label] = obj;
	} else {
		for (var key in obj) {
			this._additionalData[key] = obj[key];
		}
	}

	return this;
};

Parser.prototype.log = function (errorObject) {

    if (this._message) {
        this.send();
    }

	this._timestamp = new Date();

	if (errorObject instanceof Error) {

		this._fullMessage = errorObject.stack.split('\n    ');
		this._fullMessage.shift();

        console.log(errorObject);
		var fileinfo = this._fullMessage[0],
			start = fileinfo.indexOf('(') + 1,
			end   = fileinfo.lastIndexOf(':');

		fileinfo = fileinfo.substr(start, end);
		fileinfo = fileinfo.split(':');

		this._message = errorObject.message;
		this.data({
			type: errorObject.name,
			file: fileinfo[0],
			line: fileinfo[1]
		});
	} else {
		this._message = this._join(arguments);
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

	this.emit(this.channel, {
		short_message   : this._message,
		full_message    : this._fullMessage,
		additional_data : this._additionalData,
		timestamp       : this._timestamp
	});

	// call underlying function

	this.channel         = null;
	this._message        = null;
	this._timestamp      =
	this._fullMessage    = [];
	this._additionalData = null;

	this._additionalDataCount = 0;
};

Parser.prototype.decoy = function () {
    if (this._message) {
        this.send();
    }

	return this;
};

Parser.prototype._join = function (args) {
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
};

exports.Parser = Parser;
