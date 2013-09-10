var path = require('path');
var util = require('util');
var Writer = require('../Writer');
var cluster = require('cluster');


function FileWriter(cfg) {
	Writer.call(this);

	this.path = cfg.path;
	this.mode = parseInt(cfg.mode || '0666', 8);
	this.format = cfg.format || 'json';
	this.jsonIndent = cfg.jsonIndent || 2;
	this.encoding = cfg.encoding || 'utf8';
	this.maxChannelNameLength = 0;
}


util.inherits(FileWriter, Writer);


FileWriter.prototype.channelFunctionGenerator = function (channelName) {
	var filePath = path.join(this.path, channelName + '.log');
	var options = {
		flags: 'a',
		encoding: this.encoding,
		mode: this.mode
	};

	var that = this;
	var stream = require('fs').createWriteStream(filePath, options);

	var failureLogged = false;

	stream.on('error', function (error) {
		if (!failureLogged) {
			console.error('Error while writing to "' + filePath + '":', error);
		}

		failureLogged = true;
	});

	this.once('destroy', function () {
		stream.close();
	});

	// create a serializer function that will write its log argument to terminal

	var jsonIndent = this.jsonIndent;
	var role = cluster.isMaster ? 'm' : 'w';
	var prefix = role + '-' + process.pid + ' - ';

	this.maxChannelNameLength = Math.max(this.maxChannelNameLength, channelName.length);

	function getChannelHint() {
		var len = that.maxChannelNameLength - channelName.length;
		var spaces = new Array(len + 1).join(' '); // +1 because spaces generated is length-1

		return spaces + '<' + channelName + '>';
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
			msg += '\n' + JSON.stringify(entry.data, null, jsonIndent);
		}

		// we use the ISOString format for the date, it as written as an UTC date using the format YYYY-MM-DDTHH:mm:ss.sssZ
		// it has the advantage to be easily parse-able (just do `new Date(isostring)` and you are set)
		// Read more: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString
		var output = prefix + (new Date(entry.timestamp)).toISOString() + ' ' + getChannelHint() + ' ' + msg + '\n';

		stream.write(output);
	};
};

module.exports = FileWriter;
