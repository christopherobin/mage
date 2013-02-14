var mage = require('../mage');
var logger = mage.core.logger.context('archivist');
var VaultValue = require('./vaultValue').VaultValue;
var createTrueName = require('rumplestiltskin').trueName;
var async = require('async');
var valueHandlers = require('./valueHandlers');


// Value handlers
// --------------
// these are handlers written by the user to handle how to create keys, shards, do serialization
// and to provide hooks before distribution.

exports.registerValueHandlers = function (handlers) {
	valueHandlers.registerValueHandlers(handlers);
};


// Vault creation
// --------------
// Every game has a setup function that looks through its config file for
// vaults and registers them with the Archivists.

var persistentVaults = {};


function createVault(vaultName, vaultType, vaultConfig, cb) {
	var vaultMod = require('./vaults/' + vaultType);
	var vault = vaultMod.create(vaultName);

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

var readOrder = [], writeOrder = [];

exports.registerReadOrder = function (vaultNames) {
	readOrder = vaultNames;
};

exports.registerWriteOrder = function (vaultNames) {
	writeOrder = vaultNames;
};


// vault access helpers for the Archivist class
// --------------------------------------------

function attemptReadFromVault(vault, value, cb) {
	// undefined response indicates non-existence in this vault
	// this may be totally acceptable for volatile caches

	if (!vault.archive.read) {
		var error = new Error('Read operations not supported on vault ' + vault.name);
		logger.alert(error);
		return cb(error);
	}

	var api = valueHandlers.getHandler(vault.name, value.topic);
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

		cb();
	});
}


function validateChangesForVaults(state, value, vaults, cb) {
	// if there was no change on the value, we have nothing to validate

	if (!value.operation) {
		return cb();
	}

	// check the beforeDistribute() logic of each vault for this tome

	async.forEachSeries(
		vaults,
		function (vault, callback) {
			var handler = valueHandlers.getHandler(vault.name, value.topic);

			if (!handler || !handler.beforeDistribute) {
				return callback();
			}

			handler.beforeDistribute(state, value, callback);
		},
		cb
	);
}


function applyChangesToVault(value, vault, cb) {
	// if there was no change on the value, we have nothing to apply

	if (!value.operation) {
		return cb();
	}

	// check if this value can be stored in this vault, by pulling out the API for this topic

	var api = valueHandlers.getHandler(vault.name, value.topic);
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
	this.privateVaults = {};
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
			return cb(error);
		}

		that.privateVaults[vaultName] = vault;
		cb();
	});
};


Archivist.prototype.getValueHandler = function (vault, topic) {
	return valueHandlers.getHandler(vault.name, topic);
};


// vault accessors

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

	var trueName = createTrueName(index || {}, topic);
	var value = this.loaded[trueName];

	if (!value) {
		value = new VaultValue(topic, index);

		this.loaded[trueName] = value;
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

			cb();
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
		value.setMediaType(options.mediaTypes);
	}

	// make sure the encoding is what is should be

	if (options.encodings) {
		value.setEncoding(options.encodings, options.encodingOptions || {});
	}
}


// CRUD: Create

Archivist.prototype.create = function (topic, index, data, mediaType, encoding, expirationTime) {
	// both mediaType and encoding are optional, and can be detected

	var value = this._requestVaultValue(topic, index);
	value.initWithData(mediaType, data, encoding);

	if (expirationTime) {
		value.touch(expirationTime);
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
	var value = this._requestVaultValue(topic, index);

	function valueRead() {
		// apply options

		try {
			applyReadOptions(normalizeReadOptions(archivist, options), value);
		} catch (error) {
			return archivist.state.error(null, error, cb);
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
			return cb(error);
		}

		return valueRead();
	});
};


// CRUD: Update

Archivist.prototype.update = function (topic, index, data, mediaType, encoding, expirationTime) {
	// both mediaType and encoding are optional, and can be detected

	var value = this._requestVaultValue(topic, index);
	value.setData(mediaType, data, encoding);

	if (expirationTime) {
		value.touch(expirationTime);
	}
};


// CRUD: Delete

Archivist.prototype.del = function (topic, index) {
	// both mediaType and encoding are optional, and can be detected

	this._requestVaultValue(topic, index).del();
};


// Not so CRUD: Touch

Archivist.prototype.touch = function (topic, index, expirationTime) {
	// both mediaType and encoding are optional, and can be detected

	this._requestVaultValue(topic, index).touch(expirationTime);
};


// distributing mutations

Archivist.prototype.distribute = function (cb) {
	// TODO: Make it possible for this method to be run multiple times,
	//       Allowing developers to batch their writes. That means we need to reset a VaultValue's
	//       operation after a distribution.
	//       We should also clean out the caches (or we make a separate method for that).

	var that = this;
	var state = this.state;
	var trueNames = Object.keys(this.loaded);
	var vaults = this.getWriteVaults();

	logger.debug('Distributing all value changes');

	function applyChanges() {
		async.forEachSeries(
			vaults,
			function (vault, callback) {
				async.forEachSeries(
					trueNames,
					function (trueName, callback) {
						var value = that.loaded[trueName];

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
		trueNames,
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
