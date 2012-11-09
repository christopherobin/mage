var util   = require('util'),
    logger = require('../index'),
    Writer = require('./writer');


function TerminalWriter(cfg, parser) {
	this.parser = parser;
	this.reconfigure(cfg);
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


TerminalWriter.prototype.channelFunctionGenerator = function (channel) {
	// create a serializer function that will write its log argument to terminal

	var outputStream = this.outputStreams[channel] || process.stdout;
	var jsonIndent = this.jsonIndent;
	var that = this;
	var prefix = '[' + process.pid + '] ';
	var indent = new Array(prefix.length + 1).join(' ');

	return function (log) {
		var output = prefix + log.timestamp.toJSON() + ' ' + log.shortMessage;

		// Full message, indented
		if (log.fullMessage.length > 0) {
			output += '\n' + indent + log.fullMessage.join('\n' + indent);
		}

		// Additional info, formatted (JSON)
		if (log.additionalData) {
			output += '\n' + JSON.stringify(log.additionalData, null, jsonIndent).replace(/^/gm, indent);
		}

		// Coloring
		if (that.theme && output[channel]) {
			output = output[channel];
		}

		output += '\n';

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

