var mage = require('../mage');
var logger = mage.core.logger.context('archivist');
var VaultValue = require('./vaultValue').VaultValue;
var createTrueName = require('rumplestiltskin').trueName;
var async = require('async');
var valueHandlers = require('./valueHandlers');

require('./vaultValue').setup(logger);


// configuration for topics
// { topicName: { readOptions: {}, .. }

var topicConfigs = {};


// Value handlers
// --------------
// these are handlers written by the user to handle how to create keys, shards, do serialization
// and to provide hooks before distribution.

exports.registerTopics = function (topics) {
	for (var topic in topics) {
		var cfg = topics[topic];

		if (!cfg || !cfg.vaults) {
			continue;
		}

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
			for (var key in cfg.readOptions) {
				topicConfig.readOptions[key] = cfg.readOptions[key];
			}
		}

		// store hooks

		topicConfig.afterLoad = cfg.afterLoad;
		topicConfig.beforeDistribute = cfg.beforeDistribute;

		// store the topic config

		topicConfigs[topic] = topicConfig;

		// register vault handlers

		valueHandlers.registerValueHandlersForTopic(topic, cfg.index || [], cfg.vaults);
	}
};


// Vault creation
// --------------
// Every game has a setup function that looks through its config file for
// vaults and registers them with the Archivists.

var persistentVaults = {};


function createVault(vaultName, vaultType, vaultConfig, cb) {
	var vaultMod = require('./vaults/' + vaultType);
	var vault = vaultMod.create(vaultName, logger.context('vault:' + vaultName));

	vault.setup(vaultConfig, function (error) {
		if (error) {
			return cb(error);
		}

		valueHandlers.addDefaultHandlersForVault(vaultName, vaultMod.defaultValueHandlers);

		cb(null, vault);
	});
}


exports.createVault = function (vaultName, vaultType, vaultConfig, cb) {
	createVault(vaultName, vaultType, vaultConfig, function (error, vault) {
		if (error) {
			return cb(error);
		}

		persistentVaults[vaultName] = vault;
		cb();
	});
};


exports.createVaults = function (cfg, cb) {
	var list = Object.keys(cfg);

	async.forEachSeries(
		list,
		function (vaultName, callback) {
			exports.createVault(vaultName, cfg[vaultName].type, cfg[vaultName].config, callback);
		},
		cb
	);
};


// API to manage the order in which we read and write

var listOrder = [];
var readOrder = [];
var writeOrder = [];

exports.registerListOrder = function (vaultNames) {
	if (!vaultNames || !vaultNames.length) {
		logger.warning('No vaultnames provided for listOrder');
		return;
	}

	listOrder = vaultNames;
};

exports.registerReadOrder = function (vaultNames) {
	if (!vaultNames || !vaultNames.length) {
		logger.warning('No vaultnames provided for readOrder');
		return;
	}

	readOrder = vaultNames;
};

exports.registerWriteOrder = function (vaultNames) {
	if (!vaultNames || !vaultNames.length) {
		logger.warning('No vaultnames provided for writeOrder');
		return;
	}

	writeOrder = vaultNames;
};


exports.topicExists = function (topic) {
	return !!topicConfigs[topic];
};


// sanity checks

exports.assertTopicSanity = function () {
	// checks for each configured topic if there is at least one vault set up to read or write with

	var topics = Object.keys(topicConfigs);

	for (var i = 0; i < topics.length; i++) {
		var topic = topics[i];
		var handlers = valueHandlers.getHandlersForTopic(topic);
		var found = false;

		var vaultNames = Object.keys(handlers);

		// now make sure we have at least 1 persistent vault represented in vaultNames

		for (var j = 0; j < vaultNames.length && !found; j++) {
			var vaultName = vaultNames[j];

			if (persistentVaults[vaultName] && (readOrder.indexOf(vaultName) !== -1 || writeOrder.indexOf(vaultName) !== -1)) {
				found = true;
			}
		}

		if (!found) {
			throw new Error('No readable or writable vaults configured for topic "' + topic + '"');
		}
	}
};


// confirm topic abilities

exports.assertTopicAbilities = function (topic, index, operations) {
	// operations: ['list', 'get', 'add', 'set', 'touch', 'del']

	var handlers = valueHandlers.getHandlersForTopic(topic);
	var vaultNames = Object.keys(handlers);

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

	var i, j, vaultName, handler;

	// check index

	if (Array.isArray(index)) {
		for (i = 0; i < vaultNames.length; i++) {
			vaultName = vaultNames[i];
			handler = handlers[vaultName];

			if (!handler.index) {
				throw new Error('Expected index ' + JSON.stringify(index) + ' for topic "' + topic + '", but none was found.');
			}

			if (handler.index.length !== index.length) {
				throw new Error('Expected index ' + JSON.stringify(index) + ' for topic "' + topic + '", instead found: ' + JSON.stringify(handler.index));
			}

			var assertIndexes = index.slice().sort();
			var configIndexes = handler.index.slice().sort();

			for (j = 0; j < configIndexes.length; j++) {
				if (configIndexes[j] !== assertIndexes[j]) {
					throw new Error('Expected index ' + JSON.stringify(index) + ' for topic "' + topic + '", key "' + assertIndexes[j] + '" not found, instead found ' + JSON.stringify(handler.index));
				}
			}
		}
	}

	// check operations

	if (operations) {
		for (i = 0; i < operations.length; i++) {
			var operation = operations[i];
			var opVaultNames = operationVaultNames[operation];
			var found = false;

			if (!opVaultNames) {
				throw new Error('Unrecognized operation "' + operation + '". Supported: ' + Object.keys(operationVaultNames).join(', '));
			}

			for (j = 0; j < vaultNames.length && !found; j++) {
				vaultName = vaultNames[j];

				// if this vault is not used in listOrder, readOrder, writeOrder, don't make the check

				if (opVaultNames.indexOf(vaultName) === -1) {
					continue;
				}

				var vault = persistentVaults[vaultName];

				if (!vault || !vault.archive) {
					continue;
				}

				if (typeof vault.archive[operation] === 'function') {
					found = true;
				}
			}

			if (!found) {
				throw new Error('None of vaults ' + JSON.stringify(vaultNames) + ' is compatible with "' + operation + '"');
			}
		}
	}
};


// vault access helpers for the Archivist class
// --------------------------------------------

function attemptListIndexesFromVault(state, vault, topic, partialIndex, options, cb) {
	// 0-length array response indicates non-existence in this vault
	// this may be totally acceptable for volatile caches

	if (!vault.archive.list) {
		return state.error(null, new Error('List-operations not supported on vault ' + vault.name), cb);
	}

	var valueHandler = valueHandlers.getHandler(vault.name, topic);
	if (!valueHandler) {
		// no API available for this topic on this vault

		logger.verbose('No API available for topic', topic, 'on vault', vault.name);
		return cb();
	}

	// check if there even is an index

	if (!valueHandler.index || !valueHandler.index.length) {
		return state.error(null, 'Cannot list indexes on a topic without an index signature', cb);
	}

	// attempt to get from the vault

	logger.verbose('Attempting to list indexes for topic', topic, 'on vault', vault.name);

	vault.archive.list(valueHandler, topic, partialIndex, options, function (error, indexes) {
		if (error) {
			return state.error(null, error, cb);
		}

		// value should be undefined to indicate a valid case of non-existing value

		logger.verbose('Found', indexes.length, 'indexes in vault', vault.name);

		cb(null, indexes);
	});
}


function attemptReadFromVault(state, vault, value, cb) {
	// undefined response indicates non-existence in this vault
	// this may be totally acceptable for volatile caches

	if (!vault.archive.get) {
		return state.error(null, new Error('Get-operations not supported on vault ' + vault.name), cb);
	}

	var valueHandler = valueHandlers.getHandler(vault.name, value.topic);
	if (!valueHandler) {
		// no API available for this topic on this vault

		logger.verbose('No API available for topic', value.topic, 'on vault', vault.name);
		return cb();
	}

	// attempt to get from the vault

	logger.verbose('Attempting to get', value.topic, 'value from vault', vault.name);

	vault.archive.get(valueHandler, value, function (error) {
		if (error) {
			return state.error(null, error, cb);
		}

		// value should be undefined to indicate a valid case of non-existing value

		if (value.data === undefined) {
			logger.verbose('No data found in vault', vault.name, 'for topic', value.topic, 'with index', value.index);

			value.registerReadMiss(vault);

			return cb();
		}

		logger.verbose('MediaType', value.mediaType, 'value found in vault', vault.name);

		cb();
	});
}


// Archivist instances manage access to vaults
// -------------------------------------------

function Archivist(state) {
	this.state = state;
	this.loaded = {};
	this.privateVaults = {};
}

exports.Archivist = Archivist;


Archivist.prototype.clearCache = function () {
	this.loaded = {};
};


// createVault allows you to add a vault for just this instance of Archivist

Archivist.prototype.createVault = function (vaultName, vaultType, vaultConfig, cb) {
	var privateVaults = this.privateVaults;

	createVault(vaultName, vaultType, vaultConfig, function (error, vault) {
		if (error) {
			return cb(error);
		}

		privateVaults[vaultName] = vault;
		cb();
	});
};


Archivist.prototype.getValueHandler = function (vaultName, topic) {
	return valueHandlers.getHandler(vaultName, topic);
};


// vault accessors

Archivist.prototype.getListVault = function (vaultName) {
	if (listOrder.indexOf(vaultName) !== -1) {
		return this.privateVaults[vaultName] || persistentVaults[vaultName];
	}
};


Archivist.prototype.getReadVault = function (vaultName) {
	if (readOrder.indexOf(vaultName) !== -1) {
		return this.privateVaults[vaultName] || persistentVaults[vaultName];
	}
};


Archivist.prototype.getWriteVault = function (vaultName) {
	if (writeOrder.indexOf(vaultName) !== -1) {
		return this.privateVaults[vaultName] || persistentVaults[vaultName];
	}
};


Archivist.prototype.getListVaults = function () {
	var result = [];

	for (var i = 0, len = listOrder.length; i < len; i++) {
		var vault = this.getListVault(listOrder[i]);
		if (vault) {
			result.push(vault);
		}
	}

	return result;
};


Archivist.prototype.getReadVaults = function () {
	var result = [];

	for (var i = 0, len = readOrder.length; i < len; i++) {
		var vault = this.getReadVault(readOrder[i]);
		if (vault) {
			result.push(vault);
		}
	}

	return result;
};


Archivist.prototype.getWriteVaults = function () {
	var result = [];

	for (var i = 0, len = writeOrder.length; i < len; i++) {
		var vault = this.getWriteVault(writeOrder[i]);
		if (vault) {
			result.push(vault);
		}
	}

	return result;
};


// loaded value access

Archivist.prototype._requestVaultValue = function (topic, index) {
	// creates a value if not yet existing in the loaded map

	if (!index) {
		index = {};
	}

	var trueName = createTrueName(index, topic);
	var value = this.loaded[trueName];

	if (!value) {
		value = new VaultValue(topic, index);

		this.loaded[trueName] = value;
	}

	return value;
};


function normalizeReadOptions(topic, options) {
	var defaults = (topicConfigs[topic] && topicConfigs[topic].readOptions) || {};

	if (!options) {
		return defaults;
	}

	var key, copy = {};

	for (key in defaults) {
		if (defaults.hasOwnProperty(key)) {
			copy[key] = defaults[key];
		}
	}

	for (key in options) {
		if (options.hasOwnProperty(key)) {
			copy[key] = options[key];
		}
	}

	return copy;
}


function applyReadOptions(options, value) {
	logger.verbose('Applying read options', options, 'to value of topic', value.topic, 'and index', value.index);

	// if the value was not optional, yet none is set, fail

	if (value.data === undefined) {
		if (options.optional) {
			// there are no options to apply to a non-existing value
			return;
		}

		throw new Error('Value does not exist');
	}

	// make sure the mediaType is what it should be

	if (options.mediaTypes) {
		value.setMediaType(options.mediaTypes);
	}

	// make sure the encoding is what is should be

	if (options.encodings) {
		value.setEncoding(options.encodings, options.encodingOptions || {});
	}
}


// OPERATION: Get

Archivist.prototype.get = function (topic, index, options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = undefined;
	}

	this.getValue(topic, index, options, function (error, value) {
		if (error) {
			return cb(error);
		}

		cb(null, value.data);
	});
};


// OPERATION: Get (special case: returns a VaultValue)
// Archivist#get depends on this method

Archivist.prototype.getValue = function (topic, index, options, cb) {
	// parameter cleanup

	if (typeof options === 'function') {
		cb = options;
		options = undefined;
	}

	var that = this;
	var state = this.state;
	var value = this._requestVaultValue(topic, index);
	var wasInitialized = value.initialized;


	function load(callback) {
		if (wasInitialized) {
			return callback();
		}

		// load the value from a vault

		var vaults = that.getReadVaults();
		var vaultNum = 0;

		logger.debug('Getting topic', topic);

		return async.whilst(
			function () {
				// while there is a vault to query and data has not been read

				return vaults[vaultNum] && !value.initialized;
			},
			function (callback) {
				attemptReadFromVault(state, vaults[vaultNum++], value, callback);
			},
			callback
		);
	}


	function postProcess(callback) {
		try {
			applyReadOptions(normalizeReadOptions(topic, options), value);
		} catch (error) {
			return state.error(null, error, callback);
		}

		return callback();
	}


	function afterLoadHook(callback) {
		// we only run this hook once

		if (wasInitialized) {
			return callback();
		}

		var topicConfig = topicConfigs[topic];

		// check for an afterLoad hook
		// if there is none or if no data was loaded in the first place, continue

		if (!value.initialized || !topicConfig.afterLoad) {
			return callback();
		}

		// if there's a afterLoad hook, run it now

		logger.debug('Applying afterLoad logic to', topic);

		return topicConfig.afterLoad(state, value, callback);
	}


	async.series([
		load,
		postProcess,
		afterLoadHook
	], function (error) {
		cb(error, value);
	});
};


// multiget helper function

function mgetAggregate(queries, options, retriever, cb) {
	// queries: [{ topic: 'foo', index: { id: 1 } }, { topic: 'bar', index: { id: 'abc' } }]
	//   OR:
	// queries: { uniqueID: { topic: 'foo', index: { id: 1 } }, uniqueID2: { topic: 'bar', index: { id: 'abc' } } }

	function arrayQuery() {
		async.mapSeries(queries, retriever, cb);
	}

	function objectQuery() {
		var result = {};

		async.forEachSeries(
			Object.keys(queries),
			function (queryId, callback) {
				retriever(queries[queryId], function (error, data) {
					if (error) {
						callback(error);
					} else {
						result[queryId] = data;
						callback();
					}
				});
			},
			function (error) {
				if (error) {
					cb(error);
				} else {
					cb(null, result);
				}
			}
		);
	}

	if (Array.isArray(queries)) {
		arrayQuery();
	} else {
		objectQuery();
	}
}


// OPERATION: Multiget

Archivist.prototype.mget = function (queries, options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = undefined;
	}

	var that = this;

	function retriever(query, callback) {
		that.get(query.topic, query.index, options, callback);
	}

	mgetAggregate(queries, options, retriever, cb);
};


// OPERATION: Multiget (special case: returns VaultValues)

Archivist.prototype.mgetValues = function (queries, options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = undefined;
	}

	var that = this;

	function retriever(query, callback) {
		that.getValue(query.topic, query.index, options, callback);
	}

	mgetAggregate(queries, options, retriever, cb);
};


// OPERATION: List

Archivist.prototype.list = function (topic, partialIndex, options, cb) {
	// load the indexes from a vault

	logger.debug('Loading', topic, 'indexes with partial index:', partialIndex);

	// parameter cleanup

	if (typeof options === 'function') {
		cb = options;
		options = {};
	} else {
		options = options || {};
	}

	var state = this.state;
	var vaults = this.getListVaults();

	var vaultNum = 0;
	var indexes;

	return async.whilst(
		function () {
			// while there is a vault to query and we have not received a response yet

			return vaults[vaultNum] && indexes === undefined;
		},
		function (callback) {
			attemptListIndexesFromVault(state, vaults[vaultNum++], topic, partialIndex, options, function (error, result) {
				if (error) {
					return callback(error);
				}

				if (result) {
					indexes = result;
				}

				callback();
			});
		},
		function (error) {
			if (error) {
				return cb(error);
			}

			return cb(null, indexes);
		}
	);
};


// OPERATION: Add

Archivist.prototype.add = function (topic, index, data, mediaType, encoding, expirationTime) {
	// both mediaType and encoding are optional, and can be detected

	var value = this._requestVaultValue(topic, index);
	value.add(mediaType, data, encoding);

	value.touch(expirationTime);
};


// OPERATION: Set

Archivist.prototype.set = function (topic, index, data, mediaType, encoding, expirationTime) {
	// both mediaType and encoding are optional, and can be detected

	var value = this._requestVaultValue(topic, index);
	value.set(mediaType, data, encoding);

	value.touch(expirationTime);
};


// OPERATION: Del

Archivist.prototype.del = function (topic, index) {
	this._requestVaultValue(topic, index).del();
};


// OPERATION: Touch

Archivist.prototype.touch = function (topic, index, expirationTime) {
	this._requestVaultValue(topic, index).touch(expirationTime);
};


// distributing mutations
// ----------------------

function createValueValidator(state, value) {
	var topicConfig = topicConfigs[value.topic];
	if (!topicConfig || !topicConfig.beforeDistribute) {
		return;
	}

	return function (cb) {
		topicConfig.beforeDistribute(state, value, cb);
	};
}


function createValueOperator(vault, value) {
	// figure out what operation we should be doing for this vault

	var operation = value.getOperationForVault(vault);
	if (!operation) {
		return;
	}

	// check if this value can be stored in this vault, by pulling out the API for this topic

	var valueHandler = valueHandlers.getHandler(vault.name, value.topic);
	if (!valueHandler) {
		logger.verbose('No topic API for topic', value.topic, 'on vault', vault.name);
		return;
	}

	// get the function that will execute this operation on this vault

	var fnOperation = vault.archive[operation];
	if (!fnOperation) {
		throw new Error('Operation ' + operation + ' not supported on vault ' + vault.name);
	}

	// create a function that will execute this operation

	return function (cb) {
		logger.verbose('Running operation', operation, 'for topic', value.topic, 'on vault', vault.name);

		try {
			fnOperation.call(vault.archive, valueHandler, value, function (error) {
				if (error) {
					logger.alert(error);
				}

				cb();
			});
		} catch (error) {
			logger.alert(error);
			cb(error);
		}
	};
}


Archivist.prototype.distribute = function (cb) {
	var state = this.state;
	var that = this;
	var values = [];       // a list of all values that have an operation on them (unsorted)
	var validators = [];   // a list of all validators to run before starting distribution
	var operations = [];   // a list of all operations per vault/value combination (sorted by vault)
	var i, j;

	// prepare values, validators and operators

	function prepare() {
		// make the list of values that have an operation to do

		logger.verbose('Preparing distribution of value changes');

		var trueNames = Object.keys(that.loaded);

		for (i = 0; i < trueNames.length; i++) {
			var value = that.loaded[trueNames[i]];

			if (value.hasOperation()) {
				values.push(value);

				// create a validator function if required

				var validator = createValueValidator(state, value);
				if (validator) {
					validators.push(validator);
				}
			}
		}

		// if there are no changes on any values, return early

		if (values.length === 0) {
			return;
		}

		// make a list of operation-functions for each vault/value pair

		var vaults = that.getWriteVaults();

		for (i = 0; i < vaults.length; i++) {
			for (j = 0; j < values.length; j++) {
				var operation = createValueOperator(vaults[i], values[j]);

				if (operation) {
					operations.push(operation);
				}
			}
		}
	}

	try {
		prepare();
	} catch (error) {
		logger.alert(error);
		return cb(error);
	}

	// return early if we're done

	if (values.length === 0) {
		logger.debug('No value changes to distribute');
		return cb();
	}

	// run the validation -> distribution flow

	async.series([
		function validate(callback) {
			logger.debug('Validating all value changes');

			async.series(validators, callback);
		},
		function distribute(callback) {
			logger.debug('Distributing all value changes');

			async.series(operations, callback);
		},
		function reset(callback) {
			for (var i = 0; i < values.length; i++) {
				values[i].resetOperation();
			}

			callback();
		}
	], cb);
};
