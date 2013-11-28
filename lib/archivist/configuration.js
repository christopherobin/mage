var mage = require('../mage');
var async = require('async');
var path = require('path');

var ARCHIVIST_SETUP_PATH = path.join(process.cwd(), 'lib/archivist');

var logger;

// configuration for topics
// { topicName: { readOptions: {}, .. }

var topicConfigs = {};
var topicApis = {};

var persistentVaults = {};
var listOrder = [];
var readOrder = [];
var writeOrder = [];


exports.getMigrationsPath = function (vaultName) {
	return path.join(ARCHIVIST_SETUP_PATH, 'migrations', vaultName);
};

exports.getTopicApi = function (topic, vaultName) {
	return topicApis[topic] && topicApis[topic][vaultName];
};


exports.getPersistentVault = function (name) {
	return persistentVaults[name];
};


exports.getPersistentVaults = function () {
	return persistentVaults;
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


/**
 * Used to confirm the abilities of the topic on this configured system.
 *
 * @param {string} topic        The topic to test.
 * @param {Array}  [index]      The index this topic should be.
 * @param {Array}  [operations] The operations that every vault associated with this topic *must*
 *                              support. Possible values: 'list', 'get', 'add', 'set', 'touch', 'del'
 */

exports.assertTopicAbilities = function (topic, index, operations) {
	var api = topicApis[topic];
	var topicConfig = topicConfigs[topic];

	if (!api) {
		throw new Error('Topic "' + topic + '" does not exist!');
	}

	var vaultNames = Object.keys(api);  // all these vaults are known to exist in this environment

	if (vaultNames.length === 0) {
		throw new Error('No vaults are configured for topic "' + topic + '"');
	}

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

	// Compare required operations with supported operations on configured vaults. All vaults that
	// this topic API uses must support all required operations.

	if (!operations) {
		return;
	}

	var operationVaultNames = {
		list: listOrder,
		get: readOrder,
		add: writeOrder,
		set: writeOrder,
		touch: writeOrder,
		del: writeOrder
	};

	operations.forEach(function operationTest(operation) {
		// Get a list of all vault names that could be accessed for this operation.

		var availableVaultNames = operationVaultNames[operation];

		if (!availableVaultNames) {
			throw new Error('Unrecognized operation "' + operation + '". Supported: ' + Object.keys(operationVaultNames).join(', '));
		}

		// Test which of the vaults linked to this topic API do not support this operation.

		var goodVaults = [];
		var badVaults = [];

		vaultNames.forEach(function vaultTest(vaultName) {
			// Check if this vault is configured in (list|read|write)Order. If not, this environment
			// does not use this vault and we should ignore it.

			if (availableVaultNames.indexOf(vaultName) === -1) {
				return;
			}

			// Check if the vault supports the required operation.

			var vault = persistentVaults[vaultName];

			if (!vault) {
				// ignore non-persistent vaults ("client")
				return;
			}

			if (vault.archive && typeof vault.archive[operation] === 'function') {
				goodVaults.push(vaultName);
			} else {
				badVaults.push(vaultName);
			}
		});

		if (badVaults.length > 0) {
			throw new Error('The vaults ' + JSON.stringify(badVaults) + ' are not compatible with the "' + operation + '" operation, required by topic "' + topic + '"');
		}

		if (goodVaults.length === 0) {
			throw new Error('No vault was found for topic "' + topic + '" that supports the "' + operation + '" operation');
		}
	});
};


/**
 * Do a full sanity check on topic and index.
 *
 * @param {string} topic  A value topic, used for set/get/etc..
 * @param {Object} index  A key/value index for the topic, used for set/get/etc..
 */

exports.assertTopicAndIndexSanity = function (topic, index) {
	if (!topic) {
		throw new Error('No topic given while asserting topic and index sanity');
	}

	if (!index) {
		throw new Error('No index given while asserting topic and index sanity');
	}

	if (typeof topic !== 'string') {
		throw new TypeError('Topic is not a string. Found: ' + topic);
	}

	var keys = Object.keys(index);

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		var type = typeof index[key];

		if (type !== 'string' && type !== 'number') {
			throw new TypeError(
				'Index value for "' + key + '" is not a string or number while ' +
				'asserting topic and index sanity on topic "' + topic + '". Found: ' + index[key]
			);
		}
	}

	// check correctness of the index

	exports.assertTopicAbilities(topic, keys);
};


// SETUP PHASE

function registerVaultOrders(cfg) {
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

	cfg.listOrder.forEach(function (vaultName) {
		if (vaultName !== 'client' && !cfg.vaults[vaultName]) {
			throw new Error('Vault "' + vaultName + '" was mentioned in listOrder, but is not configured');
		}
	});

	cfg.readOrder.forEach(function (vaultName) {
		if (vaultName !== 'client' && !cfg.vaults[vaultName]) {
			throw new Error('Vault "' + vaultName + '" was mentioned in readOrder, but is not configured');
		}
	});

	cfg.writeOrder.forEach(function (vaultName) {
		if (vaultName !== 'client' && !cfg.vaults[vaultName]) {
			throw new Error('Vault "' + vaultName + '" was mentioned in writeOrder, but is not configured');
		}
	});

	listOrder = cfg.listOrder;
	readOrder = cfg.readOrder;
	writeOrder = cfg.writeOrder;
}


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

	if (cfg.index && !Array.isArray(cfg.index)) {
		throw new Error('The configured index belonging to topic "' + topic + '" is not an array.');
	}

	topicConfig.index = cfg.index || [];

	// store hooks

	topicConfig.afterLoad = cfg.afterLoad;
	topicConfig.beforeDistribute = cfg.beforeDistribute;

	// store the topic config

	topicConfigs[topic] = topicConfig;
}


function getVaultType(vaultName, vaultConfig) {
	if (vaultName === 'client') {
		return 'client';
	}

	if (vaultConfig && vaultConfig.type) {
		return vaultConfig.type;
	}

	return undefined;
}


function registerTopicApiOnVault(topic, vaultName, topicConfig, vaultConfig) {
	// Test if the configured vault is at all present in list/read/write-order. If not, then
	// this environment doesn't require the topic to be stored in the vault that is specified
	// with this topic API.

	if (listOrder.indexOf(vaultName) === -1 && readOrder.indexOf(vaultName) === -1 && writeOrder.indexOf(vaultName) === -1) {
		logger.debug('Not configuring topic API for vault "' + vaultName + '" as it is not mentioned in any of list/read/write-order');
		return false;
	}

	// Get the vault type from the configuration of this vault.

	var vaultType = getVaultType(vaultName, vaultConfig);

	if (!vaultType) {
		throw new Error('No vault type has been configured on the vault with name "' + vaultName + '"');
	}

	// Get the module that implements the vault, so it can give a default topic API

	var vaultMod = getVaultMod(vaultType);

	if (!vaultMod) {
		throw new Error('No vault of type "' + vaultType + '" exists.');
	}

	// Create the API for this topic on this vault.

	var api = {
		index: topicConfig.index || []
	};

	api = overrideProperties(api, vaultMod.defaultTopicApi);
	api = overrideProperties(api, topicConfig.vaults[vaultName]);

	// Register the API.

	if (!topicApis[topic]) {
		topicApis[topic] = {};
	}

	topicApis[topic][vaultName] = api;

	return true;
}


function registerTopics(cfg, topicConfigs) {
	if (!cfg) {
		throw new Error('Archivist configuration missing');
	}

	// it is not required for any topics to exist

	if (!topicConfigs) {
		return;
	}

	if (!cfg.vaults) {
		throw new Error('No "vaults" defined in the archivist configuration');
	}

	var topics = Object.keys(topicConfigs);

	topics.forEach(function (topic) {
		var topicConfig = topicConfigs[topic];

		// register the topic configuration (readOptions, etc)

		registerTopicConfig(topic, topicConfig);

		// register topic API for vaults to use (serialize, shard, etc)

		var vaultNames = Object.keys(topicConfig.vaults || {});
		var topicHasApi = false;

		vaultNames.forEach(function (vaultName) {
			if (registerTopicApiOnVault(topic, vaultName, topicConfig, cfg.vaults[vaultName])) {
				topicHasApi = true;
			}
		});

		// if not a single vault can accomodate this topic, we must throw an error

		if (!topicHasApi) {
			throw new Error('None of the mentioned vaults for topic "' + topic + '" is available.');
		}
	});
}


function createPersistentVaults(cfg, cb) {
	if (!cfg) {
		throw new Error('No "vaults" defined in the archivist configuration');
	}

	var vaultNames = Object.keys(cfg);

	logger.debug('Creating persistent vaults', vaultNames);

	async.eachSeries(
		vaultNames,
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


exports.setup = function (_logger, cb) {
	logger = _logger;

	var cfg, topicConfigs;

	try {
		cfg = mage.core.config.get(['archivist']);
		topicConfigs = require(ARCHIVIST_SETUP_PATH);

		registerVaultOrders(cfg);
		registerTopics(cfg, topicConfigs);
	} catch (setupError) {
		logger.emergency(setupError);
		return cb(setupError);
	}

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
