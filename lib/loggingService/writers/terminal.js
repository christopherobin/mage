var util = require('util');
var Writer = require('../Writer');
var cluster = require('cluster');

function TerminalWriter(cfg) {
	Writer.call(this);

	this.reconfigure(cfg);
	this.maxChannelNameLength = 0;
}


util.inherits(TerminalWriter, Writer);


TerminalWriter.prototype.reconfigure = function (cfg) {
	if (!cfg) {
		cfg = {};
	}

	this.theme = cfg.theme || null;
	this.jsonIndent	= cfg.jsonIndent || 2;

	if (this.theme) {
		this.setTheme(this.theme);
	}
};


TerminalWriter.prototype.themes = {
	dark: {
		emergency: ['red', 'inverse', 'bold'],
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
		emergency: ['red', 'inverse', 'bold'],
		alert: ['red', 'bold'],
		critical: ['red', 'bold'],
		error: ['red', 'bold'],
		warning: ['yellow', 'bold'],
		notice: ['green', 'bold'],
		info: ['green', 'bold'],
		debug: ['cyan', 'bold'],
		verbose: 'cyan',
		time: ['cyan', 'underline']
	},
	"default": {
		emergency: ['red', 'inverse', 'bold'],
		alert: ['red', 'bold', 'underline'],
		critical: ['red', 'bold'],
		error: 'red',
		warning: 'yellow',
		notice: 'green',
		info: ['blue', 'bold'],
		debug: 'cyan',
		verbose: 'grey',
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
	var role = cluster.isMaster ? 'm' : 'w';
	var prefix = role + '-' + process.pid + ' - ';
	this.maxChannelNameLength = Math.max(this.maxChannelNameLength, channelName.length);
	var indent = '\n' + '  ';

	if (this.theme) {
		indent = '\n' + ' '.inverse + ' ';
	}

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
		var spaces = '';

		while (len--) {
			spaces += ' ';
		}

		return spaces + '<' + channelName + '>';
	}

	var colorize = function (str) {
		return str.replace(/\n^/gm, indent);
	};

	if (this.theme && ''[channelName]) {
		colorize = function (str) {
			return str[channelName].replace(/\n^/gm, indent);
		};
	}

	return function (entry) {
		var msg = entry.message;

		// prefix contexts

		if (entry.contexts) {
			msg = '[' + entry.contexts.join(' ') + '] ' + msg;
		}

		// full message, indented

		if (entry.details) {
			msg += '\n' + entry.details.join('\n');
		}

		// additional info, formatted (JSON)

		if (entry.data) {
			msg += '\ndata: ' + JSON.stringify(entry.data, null, jsonIndent);
		}

		// colorize the log entry

		msg = colorize(msg);

		var output = prefix + getTime(entry.timestamp) + ' ' + getChannelHint() + ' ' + msg + '\n';

		outputStream.write(output);
	};
};


TerminalWriter.prototype.addTheme = function (name, config) {
	this.themes[name] = config;
};


TerminalWriter.prototype.setTheme = function (name) {
	var config = this.themes[name];

	if (!config) {
		throw new Error('No color theme found called: ' + name);
	}

	require('colours').setTheme(config);
};


module.exports = TerminalWriter;

