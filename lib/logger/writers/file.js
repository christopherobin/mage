var util   = require('util'),
	writer = require('./writer');

function FileWriter(cfg, parser) {

	this.parser = parser;

	this.path		= cfg.path;
	this.mode		= cfg.mode || '0666';
	this.format		= cfg.format || 'json';
	this.jsonIndent	= cfg.jsonIndent || 2;

	this.mode = parseInt(this.mode, 8);
	this.encoding = cfg.encoding || 'utf8';
}

util.inherits(FileWriter, writer.writer);

FileWriter.prototype.channelFunctionGenerator = function (channel) {

	var outputChannel = require('fs').createWriteStream(this.path + '/' + channel + '.log', { flags: 'a', encoding: this.encoding, mode: this.mode });
	var jsonIndent = this.jsonIndent;

	return function (log) {
		var output = '[' + process.pid + '] ',
            indent = new Array(output.length + 1).join(' ');

        output += log.timestamp.toJSON() + ' ' + log.shortMessage;

		// Full message, indented
		if (log.fullMessage.length > 0) {
			output += '\n' + indent;
			output += log.fullMessage.join('\n' + indent);
		}

		// Additional info, formated (JSON)
		if (log.additionalData) {
			output += '\n';
			output += JSON.stringify(log.additionalData, null, jsonIndent).replace(/^/gm, indent);
		}

		outputChannel.write(output + '\n');
	};
};

module.exports = FileWriter;
