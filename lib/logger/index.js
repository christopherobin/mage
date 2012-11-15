var Parser = require('./parser').Parser;

var logLevels = {
	time: 0,
	verbose: 1,
	debug: 2,
	info: 3,
	notice: 4,
	warning: 5,
	error: 6,
	critical: 7,
	alert: 8,
	emergency: 9
};


var allChannelNames = Object.keys(logLevels);  // may be extended

var activeChannels = {};  // { debug: { terminal: true }, verbose: { websocket: true } }
var writerClasses = {};
var writers = {};


var parser = new Parser();


function isActive(channelName) {
	return !!activeChannels[channelName];
}


exports.addWriterType = function (typeName, WriterClass) {
	writerClasses[typeName] = WriterClass;
};


exports.setupChannel = function (name, logLevel) {
	if (allChannelNames.indexOf(name) === -1) {
		allChannelNames.push(name);
	}

	logLevels[name] = logLevel || 0;
};


exports.getAllChannelNames = function () {
	return allChannelNames;
};


exports.getLogLevels = function () {
	return logLevels;
};


function activateChannel(writerType, channelName) {
	if (!activeChannels[channelName]) {
		activeChannels[channelName] = {};
	}

	activeChannels[channelName][writerType] = true;

	exports[channelName] = function () {
		return parser.setChannel(channelName).log.apply(parser, arguments);
	};
}


function deactivateChannel(writerType, channelName) {
	// check if the channel is active at all

	if (!activeChannels[channelName]) {
		return;
	}

	// if active, remove the activation for this writer type

	delete activeChannels[channelName][writerType];

	// if there are no writers remaining for this channel, deactivate it completely

	if (Object.keys(activeChannels[channelName]).length > 0) {
		return;
	}

	delete activeChannels[channelName];

	exports[channelName] = function () {
		return parser.decoy();
	};
}


exports.has = isActive;


function channelToLogLevel(channelName) {
	return logLevels[channelName];
}


exports.parseChannelList = function (list) {
	// list: ["time", ">=info"]

	var result = {}, m, operator, channelName, level;

	if (!list || list.length === 0) {
		return [];
	}


	function addRange(from, through) {
		for (var i = 0, len = allChannelNames.length; i < len; i++) {
			var channelName = allChannelNames[i];

			var level = channelToLogLevel(channelName);

			if (level >= from && level <= through) {
				result[channelName] = true;
			}
		}
	}


	for (var i = 0, len = list.length; i < len; i++) {
		m = list[i].match(/^([<=>]{0,2})([a-z]+)$/i);
		if (!m) {
			continue;
		}

		operator = m[1];
		channelName = m[2];
		level = channelToLogLevel(channelName);

		switch (operator) {
		case '>=':
			addRange(level, Infinity);
			break;
		case '>':
			addRange(level + 1, Infinity);
			break;
		case '<=':
			addRange(0, level);
			break;
		case '<':
			addRange(0, level - 1);
			break;
		default:
			result[channelName] = true;
			break;
		}
	}

	return Object.keys(result);
};


exports.configure = function (cfg) {
	for (var writerType in cfg) {
		var info = cfg[writerType];

		exports.addWriter(writerType, info.channels, info.config);
	}
};


function updateChannels(writerType, channelNames) {
	for (var i = 0, len = allChannelNames.length; i < len; i++) {
		var channelName = channelNames[i];

		if (channelNames.indexOf(channelName) === -1) {
			deactivateChannel(writerType, channelName);
		} else {
			activateChannel(writerType, channelName);
		}
	}
}


exports.addWriter = function (type, channelList, cfg) {
	// if a writer of this type already exists, reconfigure it

	var channelNames = exports.parseChannelList(channelList);

	var writer = writers[type];
	if (writer) {
		if (cfg) {
			if (writer.reconfigure) {
				writer.reconfigure(cfg);
			} else {
				exports.error('Trying to reconfigure logger writer', type, 'but no reconfigure function is available');
			}
		}

		writer.reconfigureListeners(channelNames);
		return;
	}

	// create a new writer

	var WriterClass = writerClasses[type];

	if (!WriterClass) {
        exports.emergency('Logger type', type, 'is not available');
		return;
	}

	writer = new WriterClass(cfg, parser);


	// any time a writer changes which channels it cares about, we need to set up the channel
	// functions again

	writer.on('newChannelList', function (activeChannelNames) {
		updateChannels(type, activeChannelNames);
	});

	// register the writer

	writers[type] = writer;

	// set up the channels

	writer.reconfigureListeners(channelNames);
};


exports.addWriterType('file', require('./writers/file'));
exports.addWriterType('terminal', require('./writers/terminal'));
exports.addWriterType('graylog', require('./writers/graylog'));
exports.addWriterType('websocket', require('./writers/websocket'));
exports.addWriterType('loggly', require('./writers/loggly'));


// Add a default writer - this gets overwritten after first configuration
exports.addWriter('terminal', allChannelNames, null);

