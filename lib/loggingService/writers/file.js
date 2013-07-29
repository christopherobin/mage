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
	var options = { flags: 'a', encoding: this.encoding, mode: this.mode };

	var that = this;
	var outputStream = require('fs').createWriteStream(filePath, options);

	this.once('destroy', function () {
		outputStream.close();
	});

	// create a serializer function that will write its log argument to terminal

	var jsonIndent = this.jsonIndent;
	var role = cluster.isMaster ? 'm' : 'w';
	var prefix = role + '-' + process.pid + ' - ';

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

		var output = prefix + getTime(entry.timestamp) + ' ' + getChannelHint() + ' ' + msg + '\n';

		outputStream.write(output);
	};
};

module.exports = FileWriter;
