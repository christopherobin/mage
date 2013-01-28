var mage = require('../mage');
var logger = mage.core.logger;
var Jacket = require('./jacket').Jacket;
var Value = require('./value').Value;
var Tome = require('tomes').Tome;
var trueName = require('rumplestiltskin').trueName;
var async = require('async');

//     name - the unique identifer for this vault as defined in the game
//            config.

//     type - this vault's type, must have a type representation in vaults
//            directory.

//   config - this vault's specific configuration information.

// priority - an optional identifier for this particular vault as defined in
//            the game config, defaults to last


// Here are some example lines from a game config file.

//	"vaults": {
//		"ron": {
//			"type": "sqlite",
//			"config": { "path": "./game.sqlite" },
//			"priority": 0
//		},
//		"bob": {
//			"type": "sqlite",
//			"config": { "path": "./bob.sqlite" },
//			"priority": 1
//		},
//		"sqlite": {
//			"type": "sqlite",
//			"config": { "path": "./game.sqlite" }
//		}
//	}
//  "archivists": {
//    "server": {
//      "static": { write: ["disk", "mem", "peers"], read: ["mem", "disk"] },
//      "dynamic": { write: ["couchbase", "mysql"], read: ["couchbase", "mysql"] }
//    },
//    "game": {
//      "*": { read: ["mem", "mageserver"] }
//    },
//    "tool": {
//      "*": { write: ["mem", "mageserver"], read: ["mem", "mageserver"] }
//    }
//  }


// Every game has a setup function that looks through its config file for
// vaults and registers them with the Archivists.

function createVault(vaultName, vaultType, vaultConfig, cb) {
	var vault = require('./vaults/' + vaultType).create(vaultName);

	vault.setup(vaultConfig, function (error) {
		if (error) {
			cb(error);
		} else {
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

// TODO: we could make this an on-demand logic, which requires the API on first use
// TODO: in that case, we would only need to configure a path
// it is more restrictive though, in how node-archivist can be used

var topicsApis = {};

exports.registerTopicsApi = function (vaultName, topicsApi) {
	topicsApis[vaultName] = topicsApi;
};

function getTopicApi(vault, topic) {
	var topicApi = topicsApis[vault.name] ? topicsApis[vault.name][topic] : null;

	if (topicApi) {
		if (!topicApi.key) {
			topicApi.key = vault.generateKey || function () {};
		}

		if (!topicApi.shard) {
			topicApi.shard = vault.generateShard || function () {};
		}
	}

	return topicApi;
}


// vault access helpers for the Archivist class
// --------------------------------------------

function attemptReadFromVault(vault, jacket, cb) {
	// undefined value indicates non-existence in this vault
	// this may be totally acceptable for volatile caches

	var api = getTopicApi(vault, jacket.topic);

	if (!api) {
		// no API available for this topic on this vault

		return cb();
	}

	var key = api.key(jacket.topic, jacket.vars);
	var shard = api.shard(jacket.topic, jacket.vars);

	if (!key) {
		// no key can be generated for this topic on this vault

		return cb();
	}

	// attempt to read from the vault

	logger.verbose('Reading key:', key, 'from shard:', shard, 'on vault:', vault.name);

	vault.read(key, shard, function (error, value) {
		if (error) {
			return cb(error);
		}

		// value should be undefined to indicate a valid case of non-existing value

		if (value === undefined) {
			logger.verbose('No value found');
			return cb();
		}

		// give the jacket its value

		logger.verbose('Value found, type:', typeof value.data);
		jacket.setValue(value);

		return cb();
	});
}


function validateChangesForVaults(state, jacket, vaults, cb) {
	// if neither the value, nor the ttl changed, we have nothing to validate

	if (!jacket.hasChanges()) {
		return cb();
	}

	// check the beforechange() logic of each vault for this tome

	async.forEachSeries(
		vaults,
		function (vault, callback) {
			var api = getTopicApi(vault, jacket.topic);

			if (!api || !api.beforechange) {
				return cb();
			}

			api.beforechange(state, jacket, callback);
		},
		cb
	);
}


function applyChangesToVault(jacket, vault, cb) {
	// if neither the value, nor the ttl changed, we have nothing to apply

	if (!jacket.hasChanges()) {
		return cb();
	}

	// check if this value can be stored in this vault, by pulling out the API for this topic

	var api = getTopicApi(vault, jacket.topic);
	if (!api) {
		logger.debug('No topic API for topic', jacket.topic, 'on vault', vault.name);
		return cb();
	}

	// we'll have something to do, so figure out the key and shard for this value/vault

	var key = api.key(jacket.topic, jacket.vars);
	var shard = api.shard(jacket.topic, jacket.vars);

	if (!key) {
		// no key can be generated for this topic on this vault

		logger.error('No key can be generated for topic', jacket.topic, 'on', vault.name, 'vaults.');
		return cb();
	}

	// check if the value got deleted

	if (jacket.markedDeleted) {
		if (!vault.del) {
			logger.error('Cannot delete from', vault.name, 'vaults.');
			return cb();
		}

		logger.verbose('Deleting key:', key, 'on shard:', shard, 'from vault:', vault.name);

		return vault.del(key, shard, cb);
	}

	// if isNewlyCreated is flagged, create the value

	if (jacket.markedNew) {
		if (!vault.create) {
			logger.error('Cannot create on', vault.name, 'vaults.');
			return cb();
		}

		logger.verbose('Creating key:', key, 'on shard:', shard, 'on vault:', vault.name);

		return vault.create(key, shard, jacket.value, jacket.ttl, cb);
	}

	// if only the ttl changed, we'll touch the value with the new ttl

	if (!jacket.value || !jacket.value.hasChanged) {
		if (!vault.touch) {
			logger.error('Cannot update TTL on', vault.name, 'vaults.');
			return cb();
		}

		logger.verbose('Touching key:', key, 'on shard:', shard, 'on vault:', vault.name);

		return vault.touch(key, shard, jacket.ttl, cb);
	}

	// if the value was not newly created, nor deleted, it must be a regular update

	logger.verbose('Updating key:', key, 'on shard:', shard, 'on vault:', vault.name);

	return vault.update(key, shard, jacket.value, jacket.ttl, cb);
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


// jacket accessors

Archivist.prototype.findJacketForValue = function (data) {
	for (var key in this.loaded) {
		var jacket = this.loaded[key];

		if (jacket.value.data === data) {
			return jacket;
		}
	}

	return null;
};


Archivist.prototype.requestJacket = function (topic, vars) {
	// creates a jacket if not yet existing in the loaded map

	var valueTrueName = trueName(vars, topic);
	var jacket = this.loaded[valueTrueName];

	if (!jacket) {
		jacket = new Jacket(topic, vars);
		this.loaded[valueTrueName] = jacket;
	}

	return jacket;
};


// vault access (reads and lazy writes)

function retrieveJacketFromArchivist(archivist, topic, vars, options, cb) {
	// returns undefined for non-existing values

	var valueTrueName = trueName(vars, topic);
	var jacket = archivist.loaded[valueTrueName];

	options = options || {};

	function notFound() {
		cb(null, undefined);
	}

	function fatalError() {
		archivist._error(cb);
	}

	// check our caches first

	if (jacket && jacket.isLoaded) {
		// upgrade the value to a tome if we have to

		if (options.mediaType && jacket.value.mediaType !== options.mediaType) {
			logger.error('Loaded value is mediaType', jacket.value.mediaType, 'instead of', options.mediaType);
			return fatalError();
		}

		return cb(null, jacket);
	}

	var vaultIndex = 0;
	var lastError;
	var vaults = archivist.getReadVaults();

	jacket = new Jacket(topic, vars);

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

		attemptReadFromVault(vault, jacket, function (error) {
			if (error) {
				lastError = error;

				return tryNextVault();
			}

			if (jacket.value === null || jacket.value === undefined) {
				// if value is still null, the vault was unable to try and read
				// if value is undefined, it was not available in this vault, but may be found in the next
				// in both cases, we move on to the next vault

				lastError = null;

				return tryNextVault();
			}

			// a value was found!
			// upgrade the value to a tome if we have to
			if (options.mediaType) {
				try {
					jacket.value = jacket.value.toMediaType(options.mediaType);
				} catch (convertError) {
					logger.error('Unable to convert value to Tome', convertError);
					return fatalError();
				}
			}

			if (options.encoding) {
				try {
					jacket.value.setEncoding(options.encoding);
				} catch (encodingError) {
					logger.error('Unable to convert value to alternate encoding', encodingError);
					return fatalError();
				}
			}

			// cache it into the archivist

			archivist.loaded[valueTrueName] = jacket;

			return cb(null, jacket);
		});
	}

	tryNextVault();
}


function retrieveValueFromArchivist(archivist, topic, vars, options, cb) {
	retrieveJacketFromArchivist(archivist, topic, vars, options, function (error, jacket) {
		if (error) {
			cb(error);
		} else {
			cb(null, jacket ? jacket.value : undefined);
		}
	});
}


function retrieveDataFromArchivist(archivist, topic, vars, options, cb) {
	retrieveJacketFromArchivist(archivist, topic, vars, options, function (error, jacket) {
		if (error) {
			cb(error);
		} else {
			cb(null, (jacket && jacket.value) ? jacket.value.data : undefined);
		}
	});
}


Archivist.prototype.retrieve = function (topic, vars, options, cb) {
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

	retrieveDataFromArchivist(this, topic, vars, options, cb);
};


Archivist.prototype.retrieveRaw = function (topic, vars, options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = undefined;
	}

	retrieveDataFromArchivist(this, topic, vars, options, cb);
};


Archivist.prototype.retrieveValue = function (topic, vars, options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = undefined;
	}

	retrieveValueFromArchivist(this, topic, vars, options, cb);
};


Archivist.prototype.retrieveJacket = function (topic, vars, options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = undefined;
	}

	retrieveJacketFromArchivist(this, topic, vars, options, cb);
};


Archivist.prototype.create = function (topic, vars, data, ttl) {
	// conjures a fresh tome and jacket, and returns the tome
	// takes live JS data and turns it into a tome

	return this.createRaw(topic, vars, 'application/x-tome', Tome.conjure(data === undefined ? {} : data), 'live', ttl);
};


Archivist.prototype.createRaw = function (topic, vars, mediaType, data, encoding, ttl) {
	var value = new Value(mediaType, data, encoding);

	var jacket = new Jacket(topic, vars, true);
	jacket.setValue(value);

	if (ttl) {
		jacket.setTTL(ttl);
	}

	this.loaded[trueName(vars, topic)] = jacket;

	return data;
};


Archivist.prototype.createAuto = function (topic, vars, data) {
	// won't turn data into a Tome, but will try to fit a good mediaType (json, text/plain, octet-stream)
	// if no encoding is given, "live" is implied
	// then calls createRaw

	if (Tome.isTome(data)) {
		return this.createRaw(topic, vars, 'application/x-tome', data, 'live');
	}

	if (Buffer.isBuffer(data)) {
		return this.createRaw(topic, vars, 'application/octet-stream', data, 'buffer');
	}

	if (typeof data === 'string') {
		return this.createRaw(topic, vars, 'text/plain', data, 'utf8');
	}

	return this.createRaw(topic, vars, 'application/json', data, 'live');
};


Archivist.prototype.setValueTTL = function (data, ttl) {
	var jacket = this.findJacketForValue(data);
	if (jacket) {
		jacket.setTTL(ttl);
		return true;
	}

	return false;
};


Archivist.prototype.setUnloadedTTL = function (topic, vars, ttl) {
	// marks a jacket with a TTL
	// if there is no jacket yet, create it

	this.requestJacket(topic, vars).setTTL(ttl);
};


Archivist.prototype.delValue = function (data) {
	var jacket = this.findJacketForValue(data);
	if (jacket) {
		jacket.del();
		return true;
	}

	return false;
};


Archivist.prototype.delUnloaded = function (topic, vars) {
	// schedule a value for deletion
	// this also means that the next retrieve() for this value, should yield null/undefined

	this.requestJacket(topic, vars).del();
};


// distributing mutations

Archivist.prototype.distribute = function (cb) {
	var that = this;
	var state = this.state;
	var jacketKeys = Object.keys(this.loaded);
	var vaults = this.getWriteVaults();

	function applyChanges() {
		async.forEachSeries(
			vaults,
			function (vault, callback) {
				async.forEachSeries(
					jacketKeys,
					function (jacketKey, callback) {
						var jacket = that.loaded[jacketKeys];

						applyChangesToVault(jacket, vault, function (error) {
							console.log(error);
							// TODO: log the error as non-fatal
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
		jacketKeys,
		function (jacketKey, callback) {
			var jacket = that.loaded[jacketKey];

			validateChangesForVaults(state, jacket, vaults, callback);
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

