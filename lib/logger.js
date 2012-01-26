var Stream = require('stream').Stream,
    fs = require('fs'),
    util = require('util');


function Logger() {
	this.colors = false;
	this.pidString = '[' + process.pid + ']';
	this.types = {};
}

exports.Logger = Logger;


Logger.prototype.has = function (name) {
	return !!this.types[name];
};


Logger.prototype.useColors = function () {
	require('colors');

	this.colors = true;
};


Logger.prototype.getBaseStr = function () {
	if (this.colors) {
		return this.pidString.grey + ' ' + (new Date()).toJSON().grey;
	}

	return this.pidString + ' ' + (new Date()).toJSON();
};


Logger.prototype.logToStream = function (color, fd) {
	var out = this.getBaseStr();

	for (var i = 2, len = arguments.length; i < len; i++) {
		var obj = arguments[i];

		if (obj === undefined) {
			obj = 'undefined';
		} else if (typeof obj !== 'string') {
			try {
				obj = JSON.stringify(obj);
			} catch (e) {
				obj = util.inspect(obj);	// yields multiline strings, much more readable than JSON for stack traces etc...
			}
		}

		if (this.colors && color) {
			obj = obj[color];
		}

		out += ' ' + obj;
	}

	fd.write(out + '\n', 'utf8');
};


Logger.prototype.logToVoid = function (color) {
};


Logger.prototype.logToStdout = function (color) {
	var out = this.getBaseStr();

	for (var i = 1, len = arguments.length; i < len; i++) {
		var obj = arguments[i];

		if (obj === undefined) {
			obj = 'undefined';
		} else if (typeof obj !== 'string') {
			try {
				obj = JSON.stringify(obj);
			} catch (e) {
				obj = util.inspect(obj);	// yields multiline strings, much more readable than JSON for stack traces etc...
			}
		}

		if (this.colors && color) {
			obj = obj[color];
		}

		out += ' ' + obj;
	}

	process.stdout.write(out + '\n');
};


Logger.prototype.logToStderr = function (color) {
	var out = this.getBaseStr();

	for (var i = 1, len = arguments.length; i < len; i++) {
		var obj = arguments[i];

		if (obj === undefined) {
			obj = 'undefined';
		} else if (typeof obj !== 'string') {
			try {
				obj = JSON.stringify(obj);
			} catch (e) {
				obj = util.inspect(obj);	// yields multiline strings, much more readable than JSON for stack traces etc...
			}
		}

		if (this.colors && color) {
			obj = obj[color];
		}

		out += ' ' + obj;
	}

	process.stderr.write(out + '\n');
};


Logger.prototype.setContext = function (name, output, color) {
	var defaultOutput, that = this;

	if (!color) {
		switch (name) {
		case 'error':
		case 'warn':
			color = 'red';
			break;
		case 'debug':
			color = 'grey';
			break;
		case 'time':
			color = 'magenta';
			break;
		default:
			color = 'green';
			break;
		}
	}

	if (name === 'error') {
		defaultOutput = 'stderr';
	} else {
		defaultOutput = 'stdout';
	}

	if (!output) {
		output = defaultOutput;
	}

	this.types[name] = true;

	if (output instanceof Stream) {
		if (output.fd) {
			this[name] = this.logToStream.bind(this, color, output);
		} else {
			this.setContext(name, defaultOutput, color);	// quick default to stdout/stderr, to be overridden on open

			output.on('error', function () {
				// may not fire if we're asynchronous and the error already fired
				// in the case of mithril it's fine however.

				that.error('Could not open write stream', output.path, 'for logging', name);
			});

			output.on('open', function () {
				that[name] = that.logToStream.bind(that, color, output);
			});
		}
	} else {
		switch (output) {
		case 'stderr':
			this[name] = this.logToStderr.bind(this, color || 'red');
			break;
		case 'stdout':
			this[name] = this.logToStdout.bind(this, color || 'grey');
			break;
		case 'void':
			this.types[name] = false;
			this[name] = this.logToVoid;
			break;
		default:
			this.types[name] = false;
			console.error('Unknown log output type:', output);
			break;
		}
	}
};

