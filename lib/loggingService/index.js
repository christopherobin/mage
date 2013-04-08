var mage = require('../mage');
var LogCreator = require('./creator').LogCreator;
var ChannelMap = require('./channelMap').ChannelMap;

var channelMap = new ChannelMap();
var logCreator = new LogCreator(channelMap);

mage.core.config.setTopLevelDefault('logging', require('./default.json'));

exports.getCreator = function (newInstance) {
	if (newInstance) {
		return new LogCreator(channelMap);
	}

	return logCreator;
};


var allChannelNames = [];
var writerClasses = {};
var writers = {};
var logLevels = {};


exports.addWriterType = function (typeName, WriterClass) {
	writerClasses[typeName] = WriterClass;
};


exports.setupChannel = function (name, logLevel) {
	if (channelMap.add(name)) {
		if (allChannelNames.indexOf(name) === -1) {
			allChannelNames.push(name);
		}

		logLevels[name] = logLevel || 0;
	}
};


exports.setupChannels = function (channelMap) {
	for (var name in channelMap) {
		var logLevel = channelMap[name];

		exports.setupChannel(name, logLevel);
	}
};


exports.getAllChannelNames = function () {
	return allChannelNames;
};


exports.getLogLevels = function () {
	return logLevels;
};


exports.has = function (channelName) {
	return channelMap.isActive(channelName);
};


function channelToLogLevel(channelName) {
	return logLevels[channelName];
}


exports.parseChannelList = function (list) {
	// list: ["time", ">=info"]

	var result = {}, m, operator, channelName, level;

	if (list === 'all') {
		return allChannelNames;
	}

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


exports.destroyWriter = function (writerType) {
	var writer = writers[writerType];

	if (writer) {
		delete writers[writerType];
		writer.destroy();
	}
};


exports.configure = function () {
	var cfg = mage.core.config.logging.server;

	// destroy every existing writer that is not mentioned in cfg

	var writerTypes = Object.keys(writers);

	for (var i = 0; i < writerTypes.length; i++) {
		var writerType = writerTypes[i];

		if (!cfg.hasOwnProperty(writerType)) {
			exports.destroyWriter(writerType);
		}
	}

	// register the new writers or update existing ones with new channels/configuration

	var cfgTypes = Object.keys(cfg);

	for (var j = 0; j < cfgTypes.length; j++) {
		var cfgType = cfgTypes[j];
		var info = cfg[cfgType];

		exports.addWriter(cfgType, info.channels, info.config);
	}
};


exports.addWriter = function (type, channelList, cfg) {
	// if a writer of this type already exists, reconfigure it

	var channelNames = exports.parseChannelList(channelList);

	var writer = writers[type];
	if (writer) {
		if (cfg) {
			if (writer.reconfigure) {
				writer.reconfigure(cfg);
			} else {
				throw new Error('Trying to reconfigure logger writer ' + type + ', but no reconfigure function is available');
			}
		}

		writer.reconfigureListeners(channelNames);
		return;
	}

	// create a new writer

	var WriterClass = writerClasses[type];

	if (!WriterClass) {
		throw new Error('Logger type ' + type + ' is not available');
	}

	writer = new WriterClass(cfg);
	writer.setLogCreator(logCreator);

	// register the writer

	writers[type] = writer;

	// set up the channels

	writer.reconfigureListeners(channelNames);
};


// register built-ins

exports.addWriterType('file', require('./writers/file'));
exports.addWriterType('terminal', require('./writers/terminal'));
exports.addWriterType('graylog', require('./writers/graylog'));
exports.addWriterType('websocket', require('./writers/websocket'));
exports.addWriterType('loggly', require('./writers/loggly'));

exports.setupChannels({
	time: 0,
	verbose: 0,
	debug: 1,
	info: 2,
	notice: 3,
	warning: 4,
	error: 5,
	critical: 6,
	alert: 7,
	emergency: 8
});
