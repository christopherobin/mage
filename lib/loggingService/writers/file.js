var path = require('path');
var fs = require('fs');
var util = require('util');
var isMaster = require('cluster').isMaster;
var Writer = require('../Writer');
var loggingService = require('../');


var failureLogged = false;

function logWriteError(error) {
	if (!failureLogged) {
		console.error(error);
		failureLogged = true;
	}
}


function FileWriter(cfg) {
	Writer.call(this);

	this.path = cfg.path;
	this.mode = parseInt(cfg.mode || '0666', 8);
	this.jsonIndent = cfg.jsonIndent || 2;
	this.maxChannelNameLength = 0;
	this.channelHints = {};
	this.logStreams = {};
	this.fileNames = {};  // default: { channelName: [channelName.log] }

	// normalize fileNames per channel
	// config format: { channelRange: fileName (string or array), .. }

	var fileNames = Object.keys(cfg.fileNames);

	for (var i = 0; i < fileNames.length; i += 1) {
		var fileName = fileNames[i];
		var channelRanges = cfg.fileNames[fileName];
		var channelNames = loggingService.parseChannelList(channelRanges);

		for (var j = 0; j < channelNames.length; j += 1) {
			var channelName = channelNames[j];

			if (this.fileNames[channelName]) {
				this.fileNames[channelName].push(fileName);
			} else {
				this.fileNames[channelName] = [fileName];
			}
		}
	}
}


util.inherits(FileWriter, Writer);


FileWriter.prototype.getChannelHint = function (channelName) {
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


FileWriter.prototype.getFileStream = function (fileName) {
	var stream = this.logStreams[fileName];
	if (stream) {
		return stream;
	}

	var that = this;

	// open the file

	var filePath = path.join(this.path, fileName);
	var options = {
		flags: 'a',
		encoding: 'utf8',
		mode: this.mode
	};

	stream = fs.createWriteStream(filePath, options);

	stream.on('error', logWriteError);

	stream.once('open', function (fd) {
		// If the file already existed, the file mode will not have been set to what it was
		// configured to be. For that reason, we do it once right after opening the file.

		fs.fchmod(fd, options.mode, function (error) {
			if (error) {
				console.error(error);
			}
		});
	});

	this.once('destroy', function () {
		stream.close();
		delete that.logStreams[filePath];
	});

	this.logStreams[fileName] = stream;

	return stream;
};


FileWriter.prototype.getStreams = function (channelName) {
	var fileNames = this.fileNames[channelName] || [channelName + '.log'];
	var that = this;

	return fileNames.map(function (fileName) {
		return that.getFileStream(fileName);
	});
};


FileWriter.prototype.channelFunctionGenerator = function (channelName) {
	var streams = this.getStreams(channelName);

	// create a serializer function that will write its log argument to terminal

	var that = this;

	var jsonIndent = this.jsonIndent;
	var role = isMaster ? 'm' : 'w';
	var prefix = role + '-' + process.pid + ' - ';

	// channel hint reset

	if (channelName.length > this.maxChannelNameLength) {
		this.maxChannelNameLength = channelName.length;
		this.channelHints = {};
	}

	// generate the function that will do the writing

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

		// We use the ISOString format for the date, it as written as an UTC date using the format
		// YYYY-MM-DDTHH:mm:ss.sssZ. It has the advantage to be easily parse-able by running
		// new Date(isostring)
		// Read more: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString

		var output = prefix + (new Date(entry.timestamp)).toISOString() +
			that.getChannelHint(channelName) + msg + '\n';

		for (var i = 0; i < streams.length; i += 1) {
			streams[i].write(output);
		}
	};
};

module.exports = FileWriter;
