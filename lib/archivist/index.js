var mage = require('../mage');
var logger = mage.core.logger.context('archivist');
var vaultValueLib = require('./vaultValue');
var VaultValue = vaultValueLib.VaultValue;
var configuration = require('./configuration');
var createTrueName = require('rumplestiltskin').trueName;
var async = require('async');
var EventEmitter = require('events').EventEmitter;

var testAggressively = mage.isDevelopmentMode('archivistInspection');


exports = module.exports = new EventEmitter();


exports.setup = function (cb) {
	vaultValueLib.setup(logger);

	configuration.setup(logger, cb);
};


exports.listPeerDependencies = function () {
	return {
		'Archivist Couchbase vault': ['couchbase'],
		'Archivist DynamoDB vault': ['aws-sdk'],
		'Archivist Elasticsearch vault': ['es'],
		'Archivist Manta vault': ['manta', 'memorystream'],
		'Archivist Memcached vault': ['memcached'],
		'Archivist MySQL vault': ['mysql'],
		'Archivist Redis vault': ['redis'],
		'Archivist SQLite vault': ['sqlite3']
	};
};


// proxy methods

exports.getPersistentVaults = function () {
	return configuration.getPersistentVaults();
};

exports.assertTopicAbilities = function (topic, index, operations) {
	configuration.assertTopicAbilities(topic, index, operations);
};

exports.closeVaults = function () {
	configuration.closeVaults();
};

exports.topicExists = function (topic) {
	return configuration.topicExists(topic);
};

exports.getTopics = function () {
	return configuration.getTopics();
};

exports.migrateToVersion = function (targetVersion, cb) {
	require('./migration').migrateToVersion(targetVersion, cb);
};


// vault access helpers for the Archivist class
// --------------------------------------------

function attemptListIndexesFromVault(state, vault, topic, partialIndex, options, cb) {
	// 0-length array response indicates non-existence in this vault
	// this may be totally acceptable for volatile caches

	if (!vault.archive.list) {
		return state.error(null, 'List-operations not supported on vault ' + vault.name, cb);
	}

	var topicApi = configuration.getTopicApi(topic, vault.name);
	if (!topicApi) {
		// no API available for this topic on this vault

		logger.verbose('No API available for topic', topic, 'on vault', vault.name);
		return cb();
	}

	// check if there even is an index

	if (!topicApi.index) {
		return state.error(null, 'Cannot list indexes on a topic without an index signature', cb);
	}

	// attempt to get from the vault

	logger.verbose('Attempting to list indexes for topic', topic, 'on vault', vault.name);

	var startTime = process.hrtime();

	vault.archive.list(topicApi, topic, partialIndex, options, function (error, indexes) {
		if (error) {
			exports.emit('vaultError', vault.name, 'list');

			// alert the error and mark state as erroneous

			logger.alert('Error during "list" from vault', vault.name, error);

			return state.error(null, null, cb);
		}

		exports.emit('operation', vault.name, 'list', process.hrtime(startTime));

		// value should be undefined to indicate a valid case of non-existing value

		logger.verbose('Found', indexes.length, 'indexes in vault', vault.name);

		cb(null, indexes);
	});
}


function attemptReadFromVault(state, vault, value, cb) {
	// undefined response indicates non-existence in this vault
	// this may be totally acceptable for volatile caches

	if (!vault.archive.get) {
		return state.error(null, 'Get-operations not supported on vault ' + vault.name, cb);
	}

	var topicApi = configuration.getTopicApi(value.topic, vault.name);
	if (!topicApi) {
		// no API available for this topic on this vault

		logger.verbose('No API available for topic', value.topic, 'on vault', vault.name);
		return cb();
	}

	// attempt to get from the vault

	logger.verbose('Attempting to get', value.topic, 'value from vault', vault.name);

	var startTime = process.hrtime();

	vault.archive.get(topicApi, value, function (error) {
		if (error) {
			exports.emit('vaultError', vault.name, 'get');

			// alert the error and mark state as erroneous

			logger.alert('Error during "get" from vault', vault.name, error);

			return state.error(null, null, cb);
		}

		exports.emit('operation', vault.name, 'get', process.hrtime(startTime));

		// value should be undefined to indicate a valid case of non-existing value

		if (value.data === undefined) {
			logger.verbose(
				'No data found in vault', vault.name, 'for topic', value.topic,
				'with index', value.index
			);

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

	configuration.createVault(vaultName, vaultType, vaultConfig, function (error, vault) {
		if (error) {
			return cb(error);
		}

		privateVaults[vaultName] = vault;

		cb();
	});
};


Archivist.prototype.getTopicApi = function (topic, vaultName) {
	return configuration.getTopicApi(topic, vaultName);
};


// vault accessors

Archivist.prototype.getPrivateVault = function (name) {
	return this.privateVaults[name];
};


Archivist.prototype.getListVault = function (name) {
	var listOrder = configuration.getListOrder();
	if (listOrder.indexOf(name) !== -1) {
		return this.privateVaults[name] || configuration.getPersistentVault(name);
	}
};


Archivist.prototype.getListVaults = function () {
	var listOrder = configuration.getListOrder();
	var result = [];

	for (var i = 0; i < listOrder.length; i++) {
		var name = listOrder[i];
		var vault = this.privateVaults[name] || configuration.getPersistentVault(name);

		if (vault) {
			result.push(vault);
		}
	}

	return result;
};


Archivist.prototype.getReadVault = function (name) {
	var readOrder = configuration.getReadOrder();
	if (readOrder.indexOf(name) !== -1) {
		return this.privateVaults[name] || configuration.getPersistentVault(name);
	}
};


Archivist.prototype.getReadVaults = function () {
	var readOrder = configuration.getReadOrder();
	var result = [];

	for (var i = 0; i < readOrder.length; i++) {
		var name = readOrder[i];
		var vault = this.privateVaults[name] || configuration.getPersistentVault(name);

		if (vault) {
			result.push(vault);
		}
	}

	return result;
};


Archivist.prototype.getWriteVault = function (name) {
	var writeOrder = configuration.getWriteOrder();
	if (writeOrder.indexOf(name) !== -1) {
		return this.privateVaults[name] || configuration.getPersistentVault(name);
	}
};


Archivist.prototype.getWriteVaults = function () {
	var writeOrder = configuration.getWriteOrder();
	var result = [];

	for (var i = 0; i < writeOrder.length; i++) {
		var name = writeOrder[i];
		var vault = this.privateVaults[name] || configuration.getPersistentVault(name);

		if (vault) {
			result.push(vault);
		}
	}

	return result;
};


// loaded value access

Archivist.prototype._requestVaultValue = function (topic, index) {
	// creates a value if not yet existing in the loaded map

	var trueName = createTrueName(index || {}, topic);
	var value = this.loaded[trueName];

	if (!value) {
		value = new VaultValue(topic, index);

		if (testAggressively) {
			configuration.assertTopicAbilities(value.topic, Object.keys(value.index));
		}

		this.loaded[trueName] = value;
	}

	return value;
};


function applyReadOptions(options, value) {
	logger.verbose(
		'Applying read options', options, 'to value of topic', value.topic, 'and index', value.index
	);

	// if the value was not optional, yet none is set, fail

	if (value.data === undefined) {
		if (options.optional) {
			// there are no options to apply to a non-existing value
			return;
		}

		throw new Error(
			'Value (topic: ' + value.topic + ', index: ' + JSON.stringify(value.index) + ') ' +
			'could not be read and was not optional'
		);
	}

	// make sure the mediaType is what it should be

	if (options.mediaTypes) {
		value.setMediaType(options.mediaTypes);
	}

	// make sure the encoding is what is should be

	if (options.encodings) {
		value.setEncoding(options.encodings);
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
	var value;
	var didExist;

	function requestValue() {
		value = that._requestVaultValue(topic, index);
		didExist = value.didExist;
	}

	function load(callback) {
		if (value.didExist !== undefined) {
			return callback();
		}

		// load the value from a vault

		var vaults = that.getReadVaults();
		var readOrder = configuration.getReadOrder();
		var vaultNum = 0;

		logger.debug('Getting topic', value.topic, 'from read-vaults:', readOrder);

		return async.whilst(
			function () {
				// while there is a vault to query and data has not been read

				return vaults[vaultNum] && !value.didExist;
			},
			function (callback) {
				attemptReadFromVault(state, vaults[vaultNum++], value, callback);
			},
			function () {
				if (!value.didExist) {
					value.didNotExist();
				}

				return callback();
			}
		);
	}

	function postProcess() {
		applyReadOptions(configuration.getReadOptions(value.topic, options), value);
	}

	function afterLoadHook(callback) {
		var topicConfig = configuration.getTopicConfig(value.topic);

		// check for an afterLoad hook

		if (!topicConfig.afterLoad) {
			return callback();
		}

		// if there's a afterLoad hook, run it now

		logger.debug('Applying afterLoad logic to', value.topic);

		return topicConfig.afterLoad(state, value, callback);
	}

	// request the value

	try {
		requestValue();
	} catch (error) {
		logger.emergency(error);
		return state.error(null, null, cb);
	}

	// load the data (if we don't know whether it exists)

	load(function () {
		// analyze and process the load-result

		try {
			postProcess();
		} catch (error) {
			return state.error(null, error, cb);
		}

		// we don't rerun after-load hooks if data was already loaded, nor if data was attempted
		// to be loaded, but doesn't exist.

		if (didExist || !value.didExist) {
			return cb(null, value);
		}

		// run after-load hook

		afterLoadHook(function (error) {
			if (error) {
				return cb(error);
			}

			return cb(null, value);
		});
	});
};


// multiget helper function

function mgetAggregate(queries, retriever, cb) {
	// queries: [{ topic: 'foo', index: { id: 1 } }, { topic: 'bar', index: { id: 'abc' } }]
	//   OR:
	// queries: { uniqueID: { topic: 'foo', index: { id: 1 } }, uniqueID2: { etc }

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
	} else if (queries && typeof queries === 'object') {
		objectQuery();
	} else {
		cb(new TypeError('mget queries must be an Array or an Object'));
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

	mgetAggregate(queries, retriever, cb);
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

	mgetAggregate(queries, retriever, cb);
};


// OPERATION: List

Archivist.prototype.list = function (topic, partialIndex, options, cb) {
	// parameter cleanup

	if (typeof options === 'function') {
		cb = options;
		options = {};
	} else {
		options = options || {};
	}

	var state = this.state;

	try {
		topic = vaultValueLib.parseTopic(topic);
		partialIndex = vaultValueLib.parseIndex(partialIndex);

		if (testAggressively) {
			configuration.assertTopicAbilities(topic, Object.keys(partialIndex), ['list'], true);
		}
	} catch (error) {
		return state.error(null, error, cb);
	}

	// load the indexes from a vault

	var vaults = this.getListVaults();
	var listOrder = configuration.getListOrder();

	logger.debug(
		'Listing', topic, 'indexes with partial index', partialIndex, 'on list-vaults:', listOrder
	);

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

// OPERATION: AddToCache

Archivist.prototype.addToCache = function (topic, index, data, mediaType, encoding) {
	// noop value injection
	var value = this._requestVaultValue(topic, index);
	value.setData(mediaType, data, encoding);
	return value;
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
	var topicConfig = configuration.getTopicConfig(value.topic);
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

	var topicApi = configuration.getTopicApi(value.topic, vault.name);
	if (!topicApi) {
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
		logger.verbose(
			'Running operation', operation, 'for topic', value.topic, 'on vault', vault.name
		);

		// cb is never passed an error, because mutation operations are best-effort, and an error
		// case should never prevent other mutations from happening.

		try {
			var startTime = process.hrtime();

			fnOperation.call(vault.archive, topicApi, value, function (error) {
				if (error) {
					logger.alert(error);

					exports.emit('vaultError', vault.name, operation);
				} else {
					exports.emit('operation', vault.name, operation, process.hrtime(startTime));
				}

				cb();
			});
		} catch (error) {
			logger.alert(error);

			cb();
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

		var writeOrder = configuration.getWriteOrder();
		logger.debug('Preparing distribution of value changes to write-vaults:', writeOrder);

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
