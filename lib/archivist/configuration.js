var mage = require('../mage');
var async = require('async');
var path = require('path');

var logger;

// configuration for topics
// { topicName: { readOptions: {}, .. }

var topicConfigs = {};
var topicApis = {};

var persistentVaults = {};
var listOrder = [];
var readOrder = [];
var writeOrder = [];


exports.getTopicApi = function (topic, vaultName) {
	return topicApis[topic] && topicApis[topic][vaultName];
};


exports.getPersistentVault = function (name) {
	return persistentVaults[name];
};


exports.getListOrder = function () {
	return listOrder;
};


exports.getReadOrder = function () {
	return readOrder;
};


exports.getWriteOrder = function () {
	return writeOrder;
};


function getVaultMod(type) {
	return require('./vaults/' + type);
}


function overrideProperties(target, override) {
	if (override) {
		for (var key in override) {
			if (override.hasOwnProperty(key)) {
				target[key] = override[key];
			}
		}
	}

	return target;
}


exports.getTopicConfig = function (topic) {
	return topicConfigs[topic];
};


exports.getReadOptions = function (topic, override) {
	var cfg = topicConfigs[topic];

	if (!cfg) {
		throw new Error('Unknown topic: ' + topic);
	}

	var defaults = cfg.readOptions || {};

	if (!override) {
		return defaults;
	}

	var key, copy = {};

	for (key in defaults) {
		if (defaults.hasOwnProperty(key)) {
			copy[key] = defaults[key];
		}
	}

	for (key in override) {
		if (override.hasOwnProperty(key)) {
			copy[key] = override[key];
		}
	}

	return copy;
};


/**
 * @param {string}   topic                The name of the topic.
 * @param {Object}   cfg                  The user defined configuration of the topic.
 * @param {Array}    cfg.index            The names of the index properties. Defaults to [].
 * @param {Object}   cfg.readOptions      Read options for this topic, applied after each "get".
 * @param {Function} cfg.afterLoad        Gets called immediately after each successful "get".
 * @param {Function} cfg.beforeDistribute Gets called immediately before distribution of changes.
 */

function registerTopicConfig(topic, cfg) {
	// initialize topicConfig with defaults

	var topicConfig = {
		readOptions: {
			mediaTypes: ['application/x-tome', 'application/octet-stream'],
			encodings: ['live'],
			optional: false
		}
	};

	// overwrite readOptions with given config

	if (cfg.readOptions) {
		overrideProperties(topicConfig.readOptions, cfg.readOptions);
	}

	// store index

	topicConfig.index = cfg.index || [];

	// store hooks

	topicConfig.afterLoad = cfg.afterLoad;
	topicConfig.beforeDistribute = cfg.beforeDistribute;

	// store the topic config

	topicConfigs[topic] = topicConfig;
}


// Vault creation
// --------------

var vaultLoggers = {};

function getVaultLogger(name) {
	if (!vaultLoggers[name]) {
		vaultLoggers[name] = logger.context('vault:' + name);
	}

	return vaultLoggers[name];
}


function createVault(vaultName, vaultType, vaultConfig, cb) {
	var vaultMod = getVaultMod(vaultType);
	var vault = vaultMod.create(vaultName, getVaultLogger(vaultName));

	try {
		vault.setup(vaultConfig || {}, function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, vault);
		});
	} catch (error) {
		logger.emergency('Error setting up', vaultName, 'vault:', error);
		cb(error);
	}
}


exports.createVault = createVault;


function createPersistentVaults(cfg, cb) {
	var list = Object.keys(cfg);

	logger.debug('Creating persistent vaults', list);

	async.forEachSeries(
		list,
		function (vaultName, callback) {
			createVault(vaultName, cfg[vaultName].type, cfg[vaultName].config, function (error, vault) {
				if (error) {
					return callback(error);
				}

				persistentVaults[vaultName] = vault;

				callback();
			});
		},
		cb
	);
}


exports.closeVaults = function () {
	// if setup had not yet run, logger will be undefined
	// this can happen on very early fatal error shutdown attempts

	if (logger) {
		logger.debug('Closing all vaults...');
	}

	for (var vaultName in persistentVaults) {
		var vault = persistentVaults[vaultName];

		if (vault && vault.close) {
			vault.close();
		}
	}
};


// sanity checks

function assertTopicSanity() {
	// checks for each configured topic if there is at least one vault set up to read or write with

	var topics = Object.keys(topicConfigs);

	topics.forEach(function (topic) {
		var apis = topicApis[topic];
		var vaultNames = Object.keys(apis);

		// now make sure we have at least 1 persistent vault represented in vaultNames

		var found = vaultNames.some(function (vaultName) {
			if (!persistentVaults[vaultName]) {
				return false;
			}

			if (readOrder.indexOf(vaultName) === -1 && writeOrder.indexOf(vaultName) === -1) {
				return false;
			}

			return true;
		});

		if (!found) {
			throw new Error('No readable or writable vaults configured for topic "' + topic + '"');
		}
	});
}


exports.topicExists = function (topic) {
	return !!topicConfigs[topic];
};


exports.getTopics = function () {
	var result = {};

	var topics = Object.keys(topicConfigs);
	for (var i = 0; i < topics.length; i++) {
		var topic = topics[i];
		var cfg = topicConfigs[topic];

		result[topic] = { index: cfg.index };
	}

	return result;
};


// confirm topic abilities

exports.assertTopicAbilities = function (topic, index, operations) {
	// operations: ['list', 'get', 'add', 'set', 'touch', 'del']

	operations = operations || [];

	var api = topicApis[topic];
	var topicConfig = topicConfigs[topic];

	var vaultNames = Object.keys(api);

	if (vaultNames.length === 0) {
		throw new Error('No vaults are configured for topic "' + topic + '"');
	}

	var operationVaultNames = {
		list: listOrder,
		get: readOrder,
		add: writeOrder,
		set: writeOrder,
		touch: writeOrder,
		del: writeOrder
	};

	// compare expected index with configured index

	if (Array.isArray(index)) {
		if (!topicConfig.index) {
			throw new Error('Expected index ' + JSON.stringify(index) + ' for topic "' + topic + '", but none was found.');
		}

		if (topicConfig.index.length !== index.length) {
			throw new Error('Expected index ' + JSON.stringify(index) + ' for topic "' + topic + '", instead found: ' + JSON.stringify(topicConfig.index));
		}

		var assertIndexes = index.slice().sort();
		var configIndexes = topicConfig.index.slice().sort();

		for (var i = 0; i < configIndexes.length; i++) {
			if (configIndexes[i] !== assertIndexes[i]) {
				throw new Error('Expected index ' + JSON.stringify(index) + ' for topic "' + topic + '", key "' + assertIndexes[i] + '" not found, instead found ' + JSON.stringify(topicConfig.index));
			}
		}
	}

	// compare required operations with supported operations on configured vaults

	operations.forEach(function operationTest(operation) {
		var availableVaultNames = operationVaultNames[operation];

		if (!availableVaultNames) {
			throw new Error('Unrecognized operation "' + operation + '". Supported: ' + Object.keys(operationVaultNames).join(', '));
		}

		var found = vaultNames.some(function vaultTest(vaultName) {
			// check if this vault is configured in (list|read|write)Order

			if (availableVaultNames.indexOf(vaultName) === -1) {
				return false;
			}

			// check if the vault supports the required operation

			var vault = persistentVaults[vaultName];

			if (!vault || !vault.archive || typeof vault.archive[operation] !== 'function') {
				return false;
			}

			return true;
		});

		if (!found) {
			throw new Error('None of vaults ' + JSON.stringify(vaultNames) + ' is compatible with "' + operation + '"');
		}
	});
};


exports.setup = function (_logger, cb) {
	logger = _logger;

	var cfg = mage.core.config.get(['archivist']);
	var topicsPath = path.join(process.cwd(), 'lib/archivist');

	try {
		if (!cfg) {
			throw new Error('Archivist configuration missing');
		}

		if (!cfg.vaults) {
			throw new Error('No "vaults" defined in the archivist configuration');
		}

		if (!Array.isArray(cfg.listOrder)) {
			throw new Error('No "listOrder"-array defined in the archivist configuration');
		}

		if (!Array.isArray(cfg.readOrder)) {
			throw new Error('No "readOrder"-array defined in the archivist configuration');
		}

		if (!Array.isArray(cfg.writeOrder)) {
			throw new Error('No "writeOrder"-array defined in the archivist configuration');
		}
	} catch (cfgError) {
		logger.emergency(cfgError);
		return cb(cfgError);
	}

	listOrder = cfg.listOrder;
	readOrder = cfg.readOrder;
	writeOrder = cfg.writeOrder;

	// set up the topic configurations and APIs

	var topicConfigs;

	try {
		topicConfigs = require(topicsPath) || {};
	} catch (topicsError) {
		logger.emergency(topicsError);
		return cb(topicsError);
	}

	var topics = Object.keys(topicConfigs);

	topics.forEach(function (topic) {
		var topicConfig = topicConfigs[topic];

		// register the topic configuration (readOptions, etc)

		registerTopicConfig(topic, topicConfig);

		// register topic API for vaults to use (serialize, shard, etc)

		var vaultNames = Object.keys(topicConfig.vaults || {});

		vaultNames.forEach(function (vaultName) {
			var vaultType = vaultName === 'client' ? 'client' : cfg.vaults[vaultName].type;
			var vaultMod = getVaultMod(vaultType);

			var api = {
				index: topicConfig.index || []
			};

			api = overrideProperties(api, vaultMod.defaultTopicApi);
			api = overrideProperties(api, topicConfig.vaults[vaultName]);

			if (!topicApis[topic]) {
				topicApis[topic] = {};
			}

			topicApis[topic][vaultName] = api;
		});
	});

	// create the vaults

	createPersistentVaults(cfg.vaults, function (error) {
		if (error) {
			return cb(error);
		}

		try {
			assertTopicSanity();
		} catch (err) {
			logger.emergency(err);
			return cb(err);
		}

		return cb();
	});
};
