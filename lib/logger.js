//var Stream = require('stream').Stream,
//    fs = require('fs'),
var util = require('util');

var themes = {};
var channels = {};


function logError() {
	// log arguments to the 'error' channel, or stderr if the channel has not been set up

	if (!channels.hasOwnProperty('error')) {
		exports.set('error', process.stderr);
	}

	exports.error.apply(exports, arguments);
}


exports.addTheme = function (name, config) {
	themes[name] = config;
};


var useColors = false;

exports.setTheme = function (name) {
	var config = themes[name];
	if (!config) {
		logError('No color theme found called:', name);
		return;
	}

	useColors = true;

	require('colors').setTheme(config);
};


var prefixer = null;

exports.setPrefixer = function (fn) {
	prefixer = fn;
};


exports.has = function (name) {
	return !!channels[name];
};


exports.set = function (channel, target) {
	var stream;

	if (target === 'void') {
		exports[channel] = function () {};
		return;
	}

	if (target === 'stdout') {
		stream = process.stdout;
	} else if (target === 'stderr') {
		stream = process.stderr;
	} else if (target && target.writable) {
		stream = target;
	} else {
		logError('Invalid target given for logger channel', channel);
		return;
	}

	exports[channel] = function () {
		var len = arguments.length;
		var out = new Array(len);

		for (var i = 0; i < len; i++) {
			var arg = arguments[i];

			if (arg === undefined) {
				out[i] = 'undefined';
			} else if (typeof arg === 'string') {
				out[i] = arg;
			} else {
				try {
					out[i] = JSON.stringify(arg);   // may fail because of circular references
				} catch (e) {
					out[i] = util.inspect(arg);     // yields multiline strings, much more readable than JSON for stack traces etc...
				}
			}
		}

		var line = out.join(' ');

		if (useColors && line[channel]) {
			line = line[channel];
		}

		if (prefixer) {
			line = prefixer(channel, line) + line;
		}

		try {
			stream.write(line + '\n');
		} catch (writeError) {
			// logging failed
		}
	};
};

