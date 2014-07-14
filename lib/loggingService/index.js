var mage = require('../mage');
var async = require('async');
var LogCreator = require('./LogCreator');
var ChannelMap = require('./ChannelMap');

var channelMap = new ChannelMap();
var logCreator = new LogCreator(channelMap);


exports.getCreator = function (newInstance) {
	if (newInstance) {
		return new LogCreator(channelMap);
	}

	return logCreator;
};


exports.listPeerDependencies = function () {
	return {
		'Log writer Loggly': ['loggly'],
		'Log writer Graylog2': ['graylog2'],
		'Log writer Websocket': ['zmq']
	};
};


var allChannelNames = [];
var writerPaths = {};
var writers = {};
var logLevels = {};


exports.addWriterType = function (typeName, requirePath) {
	writerPaths[typeName] = requirePath;
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
	// list formats:
	// - falsy (yields empty array)
	// - "all" (yields all channels)
	// - "debug"
	// - ["time", ">=info"]

	var result = {}, m, operator, channelName, level;

	if (!list) {
		return [];
	}

	if (typeof list === 'string') {
		list = [list];
	}

	if (list.indexOf('all') !== -1) {
		return allChannelNames;
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


exports.destroyWriter = function (writerType, cb) {
	var writer = writers[writerType];

	if (writer) {
		if (mage.core.logger) {
			mage.core.logger.verbose('Destroying', writerType, 'log writer');
		}

		delete writers[writerType];
		writer.destroy(cb);
	} else {
		process.nextTick(cb);
	}
};


exports.destroy = function (cb) {
	if (mage.core.logger) {
		mage.core.logger.debug('Destroying all log writers');
	}

	var writerTypes = Object.keys(writers);

	async.each(writerTypes, exports.destroyWriter, cb);
};


var verboseTerminal = false;

exports.enableVerboseTerminal = function () {
	verboseTerminal = true;
};


exports.setup = function (cb) {
	var cfg = mage.core.config.get(['logging', 'server'], {});

	// destroy every existing writer that is not mentioned in cfg

	function noop() {
		// writer destroyed, do nothing
	}

	var writerTypes = Object.keys(writers);

	for (var i = 0; i < writerTypes.length; i++) {
		var writerType = writerTypes[i];

		if (!cfg.hasOwnProperty(writerType)) {
			exports.destroyWriter(writerType, noop);
		}
	}

	// register the new writers or update existing ones with new channels/configuration

	var cfgTypes = Object.keys(cfg);

	// if nothing is configured, log to terminal

	if (cfgTypes.length === 0) {
		cfg = {
			terminal: {
				channels: ['>=verbose'],
				config: {
					jsonIndent: 2,
					theme: 'default'
				}
			}
		};

		cfgTypes = Object.keys(cfg);
	}

	for (var j = 0; j < cfgTypes.length; j++) {
		var cfgType = cfgTypes[j];
		var info = cfg[cfgType];

		if (!info) {
			continue;
		}

		try {
			exports.addWriter(cfgType, info.channels, info.config);
		} catch (error) {
			mage.core.logger.emergency.data('configuration', info).log('Fatal configuration error:', error);
			return cb(error);
		}
	}

	cb();
};


exports.addWriter = function (type, channelList, cfg) {
	// if a writer of this type already exists, reconfigure it

	if (type === 'terminal' && verboseTerminal) {
		channelList = 'all';
	}

	var channelNames = exports.parseChannelList(channelList);

	var writer = writers[type];

	if (writer) {
		if (cfg) {
			if (!writer.reconfigure) {
				throw new Error('Trying to reconfigure logger writer ' + type + ', but no reconfigure function is available');
			}

			if (mage.core.logger) {
				mage.core.logger.verbose('Reconfiguring', type, 'log writer');
			}

			writer.reconfigure(cfg);
		}
	} else {
		if (mage.core.logger) {
			mage.core.logger.verbose('Creating', type, 'log writer');
		}

		var writerPath = writerPaths[type];
		if (!writerPath) {
			throw new Error('Logger type ' + type + ' does not exist');
		}

		// creating a new writer

		var WriterClass = require(writerPath);
		writer = new WriterClass(cfg || {});
		writer.setLogCreator(logCreator);

		// register the writer

		writers[type] = writer;
	}

	// set up the channels

	if (mage.core.logger && writer.supportsChannel) {
		// check for unsupported channels

		for (var i = 0; i < channelNames.length; i++) {
			if (!writer.supportsChannel(channelNames[i])) {
				mage.core.logger.alert('Log writer', type, 'does not support channel:', channelNames[i]);
			}
		}
	}

	writer.reconfigureListeners(channelNames);
};


// register built-ins

exports.addWriterType('file', './writers/file');
exports.addWriterType('terminal', './writers/terminal');
exports.addWriterType('graylog', './writers/graylog');
exports.addWriterType('websocket', './writers/websocket');
exports.addWriterType('loggly', './writers/loggly');

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
