var util   = require('util'),
	writer = require('./writer');

var file = function (cfg, parser) {

	this.parser = parser;

	this.path		= cfg.path;
	this.mode		= cfg.mode || '0666';
	this.format		= cfg.format || 'json';
	this.jsonIndent	= cfg.jsonIndent || 2;

	this.mode = parseInt(this.mode, 8);
	this.encoding = cfg.encoding || 'utf8';
};

util.inherits(file, writer.writer);

file.prototype.channelFunctionGenerator = function (channel) {

	var outputChannel = require('fs').createWriteStream(this.path + '/' + channel + '.log', { flags: 'a', encoding: this.encoding, mode: this.mode });
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

		outputChannel.write(output);
	};
};

module.exports = file;
