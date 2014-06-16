var util = require('util');
var Writer = require('../Writer');
var isMaster = require('cluster').isMaster;

function TerminalWriter(cfg) {
	Writer.call(this);

	this.reconfigure(cfg);
	this.maxChannelNameLength = 0;
	this.channelHints = {};
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
	default: {
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


TerminalWriter.prototype.getChannelHint = function (channelName) {
	var channelHint = this.channelHints[channelName];
	if (!channelHint) {
		// regenerate

		var len = this.maxChannelNameLength - channelName.length;
		var spaces = new Array(len + 1).join(' '); // +1 because spaces generated is length-1

		channelHint = ' ' + spaces + '<' + channelName + '> ';

		this.channelHints[channelName] = channelHint;
	}

	return channelHint;
};


TerminalWriter.prototype.channelFunctionGenerator = function (channelName) {
	// create a serializer function that will write its log argument to terminal

	var that = this;
	var stream = process.stderr;
	var jsonIndent = this.jsonIndent;
	var role = isMaster ? 'm' : 'w';
	var prefix = role + '-' + process.pid + ' - ';
	var indent = '\n' + '  ';

	if (this.theme) {
		indent = '\n' + ' '.inverse + ' ';
	}

	// channel hint reset

	if (channelName.length > this.maxChannelNameLength) {
		this.maxChannelNameLength = channelName.length;
		this.channelHints = {};
	}

	// timestamp output

	function getTime(ts) {
		function pad2(n) {
			return n < 10 ? '0' + n : n;
		}

		function pad3(n) {
			return n < 10 ? '00' + n : (n < 100 ? '0' + n : n);
		}

		return pad2(ts.getHours()) + ':' +
			pad2(ts.getMinutes()) + ':' +
			pad2(ts.getSeconds()) + '.' +
			pad3(ts.getMilliseconds());
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

		var output = prefix + getTime(entry.timestamp) +
			that.getChannelHint(channelName) + msg + '\n';

		stream.write(output);
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

