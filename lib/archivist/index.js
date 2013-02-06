var mage = require('../mage');
var logger = mage.core.logger.context('archivist');
var VaultValue = require('./vaultValue').VaultValue;
var Tome = require('tomes').Tome;
var trueName = require('rumplestiltskin').trueName;
var async = require('async');

// Example config:
//
// "archivist": {
//   "vaults": {
//     "file": { "type": "file", "config": { "path": "/tmp" } },
//     "memcached": { "type": "memcached", "config": { "servers": ["localhost:11211"], "prefix": "rk_drs/" } }
//   },
//   "readOrder": ["memcached", "file"],
//   "writeOrder": ["mage-client", "memcached", "file"]
// }

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
}

exports.Archivist = Archivist;


Archivist.prototype._error = function (cb) {
	// logging happens before the call to _error (in order to keep control of log levels and meta data)

	// TODO: we could just emit 'error', 'alert', etc and drop the state stuff
	if (this.state) {
		this.state.error(null, null, cb);
	} else if (cb) {
		cb(true);
	}
};


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

Archivist.prototype.requestValueByTopic = function (topic, index) {
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

function retrieveValueFromArchivist(archivist, topic, index, options, cb) {
	// returns undefined for non-existing values

	var valueTrueName = trueName(index || {}, topic);
	var value = archivist.loaded[valueTrueName];

	options = options || {};

	function fatalError() {
		archivist._error(cb);
	}

	// check our caches first

	if (value && value.initialized) {
		// upgrade the value to a tome if we have to

		if (options.mediaType && value.mediaType !== options.mediaType) {
			logger.error('Loaded value is mediaType', value.mediaType, 'instead of', options.mediaType);
			return fatalError();
		}

		return cb(null, value);
	}

	// try to load the value from a vault

	value = new VaultValue(topic, index);

	function notFound() {
		cb(null, value);
	}

	var vaultIndex = 0;
	var lastError;
	var vaults = archivist.getReadVaults();

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

				return fatalError();
			}
		}

		if (!vault) {
			// we're done with our attempts to load the value

			// if the value was not optional, fail hard
			if (!options.optional) {
				logger.error(new Error('Value does not exist'));
				return fatalError();
			}

			// return undefined to indicate non-existence
			return notFound();
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
			// upgrade the value to another mediaType if we have to

			if (options.mediaType) {
				try {
					value = value.toMediaType(options.mediaType);
				} catch (convertError) {
					logger.error(convertError);
					return fatalError();
				}
			}

			if (options.encoding) {
				try {
					value.setEncoding(options.encoding);
				} catch (encodingError) {
					logger.error(encodingError);
					return fatalError();
				}
			}

			// cache it into the archivist

			archivist.loaded[valueTrueName] = value;

			logger.verbose('Cached value as', valueTrueName);

			return cb(null, value);
		});
	}

	tryNextVault();
}


function retrieveDataFromArchivist(archivist, topic, index, options, cb) {
	retrieveValueFromArchivist(archivist, topic, index, options, function (error, value) {
		if (error) {
			cb(error);
		} else {
			cb(null, value ? value.data : undefined);
		}
	});
}


Archivist.prototype.retrieve = function (topic, index, options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = {};
	}

	options = options || {}; // { optional: boolean, mediaType: 'str', encoding: 'str' }

	if (!options.hasOwnProperty('mediaType')) {
		options.mediaType = 'application/x-tome';
	}

	if (!options.hasOwnProperty('encoding')) {
		options.encoding = 'live';
	}

	retrieveDataFromArchivist(this, topic, index, options, cb);
};


Archivist.prototype.retrieveRaw = function (topic, index, options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = undefined;
	}

	retrieveDataFromArchivist(this, topic, index, options, cb);
};


Archivist.prototype.retrieveValue = function (topic, index, options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = undefined;
	}

	retrieveValueFromArchivist(this, topic, index, options, cb);
};


Archivist.prototype.create = function (topic, index, data, ttl) {
	// conjures a fresh tome out of live data, and returns the tome

	return this.createRaw(topic, index, 'application/x-tome', Tome.conjure(data === undefined ? {} : data), 'live', ttl);
};


Archivist.prototype.createRaw = function (topic, index, mediaType, data, encoding, ttl) {
	var value = new VaultValue(topic, index);

	value.initWithData(mediaType, data, encoding);
	value.applyOperation('create');

	if (ttl) {
		value.setTTL(ttl);
	}

	this.loaded[trueName(index || {}, topic)] = value;

	return data;
};


Archivist.prototype.createAuto = function (topic, index, data) {
	// won't turn data into a Tome, but will try to fit a good mediaType (json, text/plain, octet-stream)
	// if no encoding is given, "live" is implied
	// then calls createRaw

	if (Tome.isTome(data)) {
		return this.createRaw(topic, index, 'application/x-tome', data, 'live');
	}

	if (Buffer.isBuffer(data)) {
		return this.createRaw(topic, index, 'application/octet-stream', data, 'buffer');
	}

	if (typeof data === 'string') {
		return this.createRaw(topic, index, 'text/plain', data, 'utf8');
	}

	return this.createRaw(topic, index, 'application/json', data, 'live');
};


Archivist.prototype.setData = function (topic, index, data, encoding) {
	this.requestValueByTopic(topic, index).setData(data, encoding);
};


Archivist.prototype.setTTL = function (topic, index, ttl) {
	// marks a value with a TTL
	// if there is no value yet, it will be created for us

	this.requestValueByTopic(topic, index).setTTL(ttl);
};


Archivist.prototype.del = function (topic, index) {
	// delete a value from the vaults
	// if there is no value yet, it will be created for us

	this.requestValueByTopic(topic, index).del();
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
