var util   = require('util'),
    logger = require('../index'),
	writer = require('./writer');

var terminal = function (cfg, parser) {

	this.parser = parser;
	this.reconfigure(cfg);
};

util.inherits(terminal, writer.writer);

terminal.prototype.reconfigure = function (cfg) {
	if (!cfg) {
		cfg = {};
	}

	this.theme		= cfg.theme === undefined ? 'default' : cfg.theme;
	this.jsonIndent	= cfg.jsonIndent	|| 2;

	if (this.theme !== false) {
		this.setTheme(this.theme);
	}
};

terminal.prototype.themes = {
	dark : {
		emergency	: ['rainbow', 'inverse'],
		alert		: 'red',
		critical	: 'red',
		error		: 'red',
		warning		: 'yellow',
		notice		: 'green',
		info		: 'blue',
		debug		: 'blue',
        verbose : 'grey',
		time		: ['grey', 'underline']
	},
	light : {
		emergency	: ['rainbow', 'inverse'],
		alert		: ['red', 'bold'],
		critical	: ['red', 'bold'],
		error		: ['red', 'bold'],
		warning		: ['yellow', 'bold'],
		notice		: ['green', 'bold'],
		info		: ['green', 'bold'],
		debug		: 'cyan',
        verbose : ['cyan', 'bold'],
		time		: ['cyan', 'underline']
	},
	default : {
		emergency	: ['red', 'inverse', 'bold'],
		alert		: ['red', 'bold', 'underline'],
		critical	: ['red', 'bold'],
		error		: 'red',
		warning		: 'yellow',
		notice		: 'green',
		info		: ['blue', 'bold'],
		debug		: 'grey',
        verbose : 'cyan',
		time		: 'magenta'
	}
};

terminal.prototype.outputChannels = {
	time      : 'stdout',
	debug     : 'stdout',
	info      : 'stdout',
	notice    : 'stdout',
	warning   : 'stderr',
	error     : 'stderr',
	critical  : 'stderr',
	alert     : 'stderr',
	emergency : 'stderr'
};

terminal.prototype.channelFunctionGenerator = function (channel) {

	var outputChannel = this.outputChannels[channel] || 'stdout';
	var jsonIndent = this.jsonIndent;
	var that   = this;

	return function (log) {
		var output = '[' + process.pid + '] ',
            indent = new Array(output.length + 1).join(' ');

        output += log.timestamp.toJSON() + ' ' + log.short_message;

		// Full message, indented
		if (log.full_message.length > 0) {
			output += '\n' + indent;
			output += log.full_message.join('\n' + indent);
		}

		// Additional info, formated (JSON)
		if (log.additional_data) {
			output += '\n';
			output += JSON.stringify(log.additional_data, null, jsonIndent).replace(/^/gm, indent);
		}

		// Coloring
		if (that.theme && output[channel]) {
			output = output[channel];
		}

		output += '\n';

		process[outputChannel].write(output);
	};
};

terminal.prototype.addTheme = function (name, config) {
	this.themes[name] = config;
};

terminal.prototype.setTheme = function (name) {

	var config = this.themes[name];

	if (!config) {
		return logger.error(new Error('No color theme found called:' + name));
	}

	require('colors').setTheme(config);
};

module.exports = terminal;
