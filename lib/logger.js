var Stream = require('stream').Stream,
	fs = require('fs');


function Logger() {
	this.colors = false;
	this.pidString = '[' + process.pid + ']';
}

exports.Logger = Logger;


Logger.prototype.useColors = function () {
	require('colors');

	this.colors = true;
};


Logger.prototype.getBaseArgs = function () {
	if (this.colors) {
		return [this.pidString.grey, (new Date()).toJSON().grey];
	}

	return [this.pidString, (new Date()).toJSON()];
};


Logger.prototype.logToStream = function (color, fd) {
	var out = this.getBaseArgs();

	for (var i = 2, len = arguments.length; i < len; i++) {
		var obj = arguments[i];

		if (typeof obj !== 'string') {
			try {
				obj = JSON.stringify(obj);
			} catch (e) {
				obj = require('util').inspect(obj);	// yields multiline strings, much more readable than JSON for stack traces etc...
			}
		}

		if (this.colors && color) {
			obj = obj[color];
		}

		out.push(obj);
	}

	fd.write(out.join(' ') + '\n', 'utf8');
};


Logger.prototype.logToVoid = function (color) {
};


Logger.prototype.logToStdout = function (color) {
	var args = this.getBaseArgs();

	for (var i = 1, len = arguments.length; i < len; i++) {
		var obj = arguments[i];

		if (typeof obj !== 'string') {
			obj = JSON.stringify(obj) + '';
		}

		if (this.colors && color) {
			obj = obj[color];
		}

		args.push(obj);
	}

	console.log.apply(console, args);
};


Logger.prototype.logToStderr = function (color) {
	var args = this.getBaseArgs();

	for (var i = 1, len = arguments.length; i < len; i++) {
		var obj = arguments[i];

		if (typeof obj !== 'string') {
			obj = JSON.stringify(obj) + '';
		}

		if (this.colors && color) {
			obj = obj[color];
		}

		args.push(obj);
	}

	console.error.apply(console, args);
};


Logger.prototype.setContext = function (name, output, color) {
	if (!output) {
		if (name === 'error') {
			output = 'stderr';
		} else {
			output = 'stdout';
		}
	}

	if (!color) {
		switch (name) {
		case 'error':
		case 'warn':
			color = 'red';
			break;
		case 'debug':
			color = 'grey';
			break;
		default:
			color = 'green';
			break;
		}
	}

	if (output instanceof Stream) {
		this[name] = this.logToStream.bind(this, color, output);
	} else if (output === 'stderr') {
		this[name] = this.logToStderr.bind(this, color || 'red');
	} else if (output === 'stdout') {
		this[name] = this.logToStdout.bind(this, color || 'grey');
	} else if (output === 'void') {
		this[name] = this.logToVoid;
	} else {
		console.error('Unknown log output type:', output);
	}
};

