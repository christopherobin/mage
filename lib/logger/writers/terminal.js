var util   = require('util'),
    logger = require('../index'),
    Writer = require('./writer');


function TerminalWriter(cfg, parser) {
	this.parser = parser;
	this.reconfigure(cfg);
	this.maxChannelNameLength = 0;
}


util.inherits(TerminalWriter, Writer);


TerminalWriter.prototype.reconfigure = function (cfg) {
	if (!cfg) {
		cfg = {};
	}

	this.theme = cfg.theme || 'default';
	this.jsonIndent	= cfg.jsonIndent || 2;

	if (this.theme) {
		this.setTheme(this.theme);
	}
};


TerminalWriter.prototype.themes = {
	dark: {
		emergency: ['rainbow', 'inverse'],
		alert: 'red',
		critical: 'red',
		error: 'red',
		warning: 'yellow',
		notice: 'green',
		info: 'blue',
		debug: 'blue',
        verbose: 'grey',
		time: ['grey', 'underline']
	},
	light: {
		emergency: ['rainbow', 'inverse'],
		alert: ['red', 'bold'],
		critical: ['red', 'bold'],
		error: ['red', 'bold'],
		warning: ['yellow', 'bold'],
		notice: ['green', 'bold'],
		info: ['green', 'bold'],
		debug: 'cyan',
        verbose: ['cyan', 'bold'],
		time: ['cyan', 'underline']
	},
	default: {
		emergency: ['red', 'inverse', 'bold'],
		alert: ['red', 'bold', 'underline'],
		critical: ['red', 'bold'],
		error: 'red',
		warning: 'yellow',
		notice: 'green',
		info: ['blue', 'bold'],
		debug: 'grey',
        verbose: 'cyan',
		time: 'magenta'
	}
};

var stdout = process.stdout;
var stderr = process.stderr;


TerminalWriter.prototype.outputStreams = {
	time: stdout,
	verbose: stdout,
	debug: stdout,
	info: stdout,
	notice: stdout,
	warning: stderr,
	error: stderr,
	critical: stderr,
	alert: stderr,
	emergency: stderr
};


TerminalWriter.prototype.channelFunctionGenerator = function (channelName) {
	// create a serializer function that will write its log argument to terminal

	var that = this;
	var outputStream = this.outputStreams[channelName] || process.stdout;
	var jsonIndent = this.jsonIndent;
	var prefix = '[' + process.pid + '] ';
	var indent = '\n' + ' '.inverse + ' ';
	this.maxChannelNameLength = Math.max(this.maxChannelNameLength, channelName.length);

	function getTime(ts) {
		function pad2(n) {
			return n < 10 ? '0' + n : n;
		}

		function pad3(n) {
			return n < 10 ? '00' + n : (n < 100 ? '0' + n : n);
		}

		return pad2(ts.getHours()) + ':' + pad2(ts.getMinutes()) + ':' + pad2(ts.getSeconds()) + '.' + pad3(ts.getMilliseconds());
	}

	function getChannelHint() {
		var len = that.maxChannelNameLength - channelName.length;
		var spaces = new Array(len + 1).join(' '); // +1 because spaces generated is length-1

		return spaces + '<' + channelName + '>';
	}

	var colorize = function (str) {
		return str;
	};

	if (this.theme && ''[channelName]) {
		colorize = function (str) {
			return str[channelName].replace(/\n^/gm, indent);
		};
	}

	return function (log) {
		var msg = log.shortMessage;

		// full message, indented
		if (log.fullMessage.length > 0) {
			msg += '\n' + log.fullMessage.join('\n');
		}

		// additional info, formatted (JSON)
		if (log.additionalData) {
			msg += '\n' + JSON.stringify(log.additionalData, null, jsonIndent);
		}

		// colorize the log entry

		msg = colorize(msg);

		var output = prefix + getTime(log.timestamp) + ' ' + getChannelHint() + ' ' + msg + '\n';

		outputStream.write(output);
	};
};


TerminalWriter.prototype.addTheme = function (name, config) {
	this.themes[name] = config;
};


TerminalWriter.prototype.setTheme = function (name) {
	var config = this.themes[name];

	if (!config) {
		return logger.error(new Error('No color theme found called: ' + name));
	}

	require('colors').setTheme(config);
};


module.exports = TerminalWriter;

