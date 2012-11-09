var util = require('util'),
    Writer = require('./writer');


function FileWriter(cfg, parser) {
	this.parser = parser;

	this.path		= cfg.path;
	this.mode		= cfg.mode || '0666';
	this.format		= cfg.format || 'json';
	this.jsonIndent	= cfg.jsonIndent || 2;

	this.mode = parseInt(this.mode, 8);
	this.encoding = cfg.encoding || 'utf8';
}


util.inherits(FileWriter, Writer);


FileWriter.prototype.channelFunctionGenerator = function (channelName) {

	var outputChannel = require('fs').createWriteStream(this.path + '/' + channelName + '.log', { flags: 'a', encoding: this.encoding, mode: this.mode });
	var jsonIndent = this.jsonIndent;
	var prefix = '[' + process.pid + '] ';
    var indent = new Array(prefix.length + 1).join(' ');

	return function (log) {
		var output = prefix + log.timestamp.toJSON() + ' ' + log.shortMessage;

		// Full message, indented
		if (log.fullMessage) {
			output += '\n' + indent + log.fullMessage.join('\n' + indent);
		}

		// Additional info, formatted (JSON)
		if (log.additionalData) {
			output += '\n' + JSON.stringify(log.additionalData, null, jsonIndent).replace(/^/gm, indent);
		}

		outputChannel.write(output + '\n');
	};
};

module.exports = FileWriter;
