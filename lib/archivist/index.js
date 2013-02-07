var mage = require('../mage');
var logger = mage.core.logger.context('archivist');
var VaultValue = require('./vaultValue').VaultValue;
var trueName = require('rumplestiltskin').trueName;
var async = require('async');

var topicsApis = {};  // { vaultName: { topic: { key: function(){} }, topic: {}, topic: {} }, .. }


function setTopicApisForVaultAndTopic(vaultName, topicName, addedTopicApis, overwriteExisting) {
	var vaultApi = topicsApis[vaultName];
	if (!vaultApi) {
		topicsApis[vaultName] = vaultApi = {};
	}

	var topicApi = vaultApi[topicName];
	if (!topicApi) {
		vaultApi[topicName] = topicApi = {};
	}

	var apiNames = Object.keys(addedTopicApis);

	for (var j = 0; j < apiNames.length; j++) {
		var apiName = apiNames[j];

		if (overwriteExisting || !topicApi[apiName]) {
			topicApi[apiName] = addedTopicApis[apiName];
		}
	}
}


function setTopicsApisForVaults(topicsApis) {
	var topicNames = Object.keys(topicsApis);

	for (var i = 0; i < topicNames.length; i++) {
		var topicName = topicNames[i];
		var vaultNames = Object.keys(topicsApis[topicName]);

		for (var j = 0; j < vaultNames.length; j++) {
			var vaultName = vaultNames[j];

			setTopicApisForVaultAndTopic(vaultName, topicName, topicsApis[topicName][vaultName], true);
		}
	}
}


function addDefaultTopicApisForVault(vaultName, defaultTopicApis) {
	var vaultApi = topicsApis[vaultName];
	if (!vaultApi) {
		return;
	}

	var topicNames = Object.keys(vaultApi);

	for (var i = 0; i < topicNames.length; i++) {
		var topicName = topicNames[i];

		setTopicApisForVaultAndTopic(vaultName, topicName, defaultTopicApis, false);
	}
}


// Every game has a setup function that looks through its config file for
// vaults and registers them with the Archivists.

function createVault(vaultName, vaultType, vaultConfig, cb) {
	var vaultMod = require('./vaults/' + vaultType);
	var vault = vaultMod.create(vaultName);

	vault.setup(vaultConfig, function (error) {
		if (error) {
			cb(error);
		} else {
			addDefaultTopicApisForVault(vaultName, vaultMod.defaultTopicApis);

			cb(null, vault);
		}
	});
}


// logic for global vaults
// -----------------------

var persistentVaults = {};

exports.createVault = function (vaultName, vaultType, vaultConfig, cb) {
	createVault(vaultName, vaultType, vaultConfig, function (error, vault) {
		if (error) {
			cb(error);
		} else {
			persistentVaults[vaultName] = vault;
			cb();
		}
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

var readOrder = [], writeOrder = [];

exports.registerReadOrder = function (vaultNames) {
	readOrder = vaultNames;
};

exports.registerWriteOrder = function (vaultNames) {
	writeOrder = vaultNames;
};


// topics APIs
// -----------
// these are APIs written by the user to handle how to create keys, shards, and to provide
// hooks beforesave.

exports.registerTopicsApis = function (topicsApis) {
	// { topicName: { vaultName: { api }, vaultName: { api } }, topicName: { vaultName: { api } } }

	setTopicsApisForVaults(topicsApis);
};


function getTopicApi(vault, topic) {
	return topicsApis[vault.name] ? topicsApis[vault.name][topic] : undefined;
}


// vault access helpers for the Archivist class
// --------------------------------------------

function attemptReadFromVault(vault, value, cb) {
	// undefined response indicates non-existence in this vault
	// this may be totally acceptable for volatile caches

	var api = getTopicApi(vault, value.topic);
	if (!api) {
		// no API available for this topic on this vault

		logger.verbose('No API available for topic', value.topic, 'on vault', vault.name);
		return cb();
	}

	// attempt to read from the vault

	logger.verbose('Attempting to read', value.topic, 'value from vault', vault.name);

	vault.archive.read(api, value, function (error) {
		if (error) {
			logger.alert('Read failed on vault', vault.name, error);
			return cb(error);
		}

		// value should be undefined to indicate a valid case of non-existing value

		if (value.data === undefined) {
			logger.verbose('No data found in vault', vault.name, 'for topic', value.topic, 'with index', value.index);
			return cb();
		}

		logger.verbose('MediaType', value.mediaType, 'value found in vault', vault.name);

		return cb();
	});
}


function validateChangesForVaults(state, value, vaults, cb) {
	// if neither the value, nor the ttl changed, we have nothing to validate

	if (!value.operation) {
		return cb();
	}

	// check the beforechange() logic of each vault for this tome

	async.forEachSeries(
		vaults,
		function (vault, callback) {
			var api = getTopicApi(vault, value.topic);

			if (!api || !api.beforechange) {
				return callback();
			}

			api.beforechange(state, value, callback);
		},
		cb
	);
}


function applyChangesToVault(value, vault, cb) {
	// if neither the value, nor the ttl changed, we have nothing to apply

	if (!value.operation) {
		return cb();
	}

	// check if this value can be stored in this vault, by pulling out the API for this topic

	var api = getTopicApi(vault, value.topic);
	if (!api) {
		logger.verbose('No topic API for topic', value.topic, 'on vault', vault.name);
		return cb();
	}

	// execute the operation

	var fn = vault.archive[value.operation];
	if (fn) {
		logger.verbose('Running operation', value.operation, 'for topic', value.topic, 'on vault', vault.name);

		fn.call(vault.archive, api, value, cb);
	} else {
		var error = new Error('Operation ' + value.operation + ' not supported on vault ' + vault.name);
		logger.alert(error);
		cb(error);
	}
}


// Archivist instances manage access to vaults
// -------------------------------------------

function Archivist(state) {
	this.state = state;
	this.loaded = {};
	this.extraVaults = {};
	this.readOrder = readOrder;
	this.writeOrder = writeOrder;

	this.defaultReadOptions = {
		mediaTypes: ['application/x-tome', 'application/octet-stream'],
		encodings: ['live']
	};
}

exports.Archivist = Archivist;


// createVault allows you to add a vault for just this instance of Archivist

Archivist.prototype.createVault = function (vaultName, vaultType, vaultConfig, cb) {
	var that = this;

	createVault(vaultName, vaultType, vaultConfig, function (error, vault) {
		if (error) {
			cb(error);
		} else {
			that.extraVaults[vaultName] = vault;
			cb();
		}
	});
};


Archivist.prototype.getTopicApi = function (vault, topic) {
	return getTopicApi(vault, topic);
};


// vault accessors

Archivist.prototype.getReadVault = function (vaultName) {
	if (readOrder.indexOf(vaultName) !== -1) {
		return this.extraVaults[vaultName] || persistentVaults[vaultName];
	}
};


Archivist.prototype.getWriteVault = function (vaultName) {
	if (writeOrder.indexOf(vaultName) !== -1) {
		return this.extraVaults[vaultName] || persistentVaults[vaultName];
	}
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

Archivist.prototype.requestVaultValue = function (topic, index) {
	// creates a value if not yet existing in the loaded map

	var valueTrueName = trueName(index || {}, topic);
	var value = this.loaded[valueTrueName];

	if (!value) {
		value = new VaultValue(topic, index);

		this.loaded[valueTrueName] = value;
	}

	return value;
};


// vault access (reads and lazy writes)

function retrieveIntoValueFromVaults(vaults, value, cb) {
	// returns undefined for non-existing values

	// try to load the value from a vault

	var vaultIndex = 0;
	var lastError;

	function tryNextVault() {
		var vault = vaults[vaultIndex];
		vaultIndex += 1;

		if (lastError) {
			if (vault) {
				// log the error and try the next vault

				logger.error(lastError);
			} else {
				// if we never got a value, but only errors, we should not indicate non-existence,
				// but rather return an error (we use the last one).

				logger.alert(lastError);

				return cb(lastError);
			}
		}

		if (!vault) {
			// we're done with our attempts to load the value

			return cb();
		}

		attemptReadFromVault(vault, value, function (error) {
			if (error) {
				lastError = error;

				return tryNextVault();
			}

			if (value.data === undefined) {
				// if value is undefined, it was not available in this vault, but may be found in the next

				lastError = null;

				return tryNextVault();
			}

			// a value was found!

			return cb();
		});
	}

	tryNextVault();
}


function normalizeReadOptions(archivist, options) {
	var defaults = archivist.defaultReadOptions || {};

	if (!options) {
		return defaults;
	}

	for (var key in defaults) {
		if (defaults.hasOwnProperty(key) && !options.hasOwnProperty(key)) {
			options[key] = defaults[key];
		}
	}

	return options;
}


function applyReadOptions(options, value) {
	// if the value was not optional, yet none is set, fail

	if (!options.optional && value.data === undefined) {
		throw new Error('Value does not exist');
	}

	// make sure the mediaType is what it should be

	if (options.mediaTypes) {
		value.toMediaType(options.mediaTypes);
	}

	// make sure the encoding is what is should be

	if (options.encodings) {
		value.setEncoding(options.encodings, options.encodingOptions || {});
	}
}


// CRUD: Create

Archivist.prototype.create = function (topic, index, data, mediaType, encoding, ttl) {
	// both mediaType and encoding are optional, and can be detected

	var value = this.requestVaultValue(topic, index);
	value.initWithData(mediaType, data, encoding);

	if (ttl) {
		value.touch(ttl);
	}

	value.applyOperation('create');
};


// CRUD: Read

Archivist.prototype.read = function (topic, index, options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = undefined;
	}

	this.readValue(topic, index, options, function (error, value) {
		if (error) {
			return cb(error);
		}

		cb(null, value.data);
	});
};


// CRUD: Read (special case: returns a VaultValue)
// Archivist#read depends on this method

Archivist.prototype.readValue = function (topic, index, options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = undefined;
	}


	var archivist = this;
	var state = this.state;
	var value = this.requestVaultValue(topic, index);

	function valueRead() {
		// apply options

		try {
			applyReadOptions(normalizeReadOptions(archivist, options), value);
		} catch (error) {
			return state.error(null, error, cb);
		}

		// return the VaultValue

		return cb(null, value);
	}

	// the value may have come from cache, in which case we do nothing

	if (value.initialized) {
		return valueRead();
	}

	// load the value from a vault

	retrieveIntoValueFromVaults(this.getReadVaults(), value, function (error) {
		if (error) {
			return state.error(null, error, cb);
		}

		return valueRead();
	});
};


// CRUD: Update

Archivist.prototype.update = function (topic, index, data, mediaType, encoding, ttl) {
	// both mediaType and encoding are optional, and can be detected

	var value = this.requestVaultValue(topic, index);
	value.setData(mediaType, data, encoding);

	if (ttl) {
		value.touch(ttl);
	}
};


// CRUD: Delete

Archivist.prototype.del = function (topic, index) {
	// both mediaType and encoding are optional, and can be detected

	this.requestVaultValue(topic, index).del();
};


// Not so CRUD: Touch

Archivist.prototype.touch = function (topic, index, ttl) {
	// both mediaType and encoding are optional, and can be detected

	this.requestVaultValue(topic, index).touch(ttl);
};


// distributing mutations

Archivist.prototype.distribute = function (cb) {
	// TODO: Make it possible for this method to be run multiple times,
	//       Allowing developers to batch their writes. That means we need to reset a VaultValue's
	//       operation after a distribution.
	//       We should also clean out the caches (or we make a separate method for that).

	var that = this;
	var state = this.state;
	var valueKeys = Object.keys(this.loaded);
	var vaults = this.getWriteVaults();

	logger.debug('Distributing all value changes');

	function applyChanges() {
		async.forEachSeries(
			vaults,
			function (vault, callback) {
				async.forEachSeries(
					valueKeys,
					function (valueKey, callback) {
						var value = that.loaded[valueKey];

						applyChangesToVault(value, vault, function (error) {
							if (error) {
								logger.error(error);
							}

							callback();
						});
					},
					function () {
						//that.emit('distributed', vault.name);
						callback();
					}
				);
			},
			cb
		);
	}

	async.forEachSeries(
		valueKeys,
		function (valueKey, callback) {
			var value = that.loaded[valueKey];

			validateChangesForVaults(state, value, vaults, callback);
		},
		function (error) {
			if (error) {
				cb(error);
			} else {
				applyChanges(cb);
			}
		}
	);
};
