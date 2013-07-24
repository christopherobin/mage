/**
 * Archivist bindings for the CouchbaseVault API
 *
 * @param {CouchbaseVault} vault The CouchbaseVault instance to wrap
 * @constructor
 */

function Archive(vault) {
	this.vault = vault;
}


module.exports = Archive;


/**
 * Gets a VaultValue from the CouchbaseVault
 *
 * @param {Object}     api   The topic API that provides the rules for key generation, serialization and sharding
 * @param {VaultValue} value The VaultValue to populate
 * @param {Function}   cb
 */

Archive.prototype.get = function (api, value, cb) {
	this.vault.get(api.createKey(value.topic, value.index), api.shard(value), function (error, data) {
		if (error) {
			return cb(error);
		}

		if (data !== undefined) {
			api.deserialize(data, value);
		}

		cb();
	});
};


/**
 * Adds a VaultValue to the CouchbaseVault
 *
 * @param {Object}     api   The topic API that provides the rules for key generation, serialization and sharding
 * @param {VaultValue} value The VaultValue to write
 * @param {Function}   cb
 */

Archive.prototype.add = function (api, value, cb) {
	this.vault.add(api.createKey(value.topic, value.index), api.shard(value), api.serialize(value), value.expirationTime, cb);
};


/**
 * Sets a VaultValue to the CouchbaseVault
 *
 * @param {Object}     api   The topic API that provides the rules for key generation, serialization and sharding
 * @param {VaultValue} value The VaultValue to write
 * @param {Function}   cb
 */

Archive.prototype.set = function (api, value, cb) {
	this.vault.set(api.createKey(value.topic, value.index), api.shard(value), api.serialize(value), value.expirationTime, cb);
};


/**
 * Updates the expiration time of a VaultValue on the CouchbaseVault
 *
 * @param {Object}     api   The topic API that provides the rules for key generation, serialization and sharding
 * @param {VaultValue} value The VaultValue with the new expiration time
 * @param {Function}   cb
 */

Archive.prototype.touch = function (api, value, cb) {
	this.vault.touch(api.createKey(value.topic, value.index), api.shard(value), value.expirationTime, cb);
};


/**
 * Deletes a VaultValue from the CouchbaseVault
 *
 * @param {Object}     api   The topic API that provides the rules for key generation, serialization and sharding
 * @param {VaultValue} value The VaultValue to delete
 * @param {Function}   cb
 */

Archive.prototype.del = function (api, value, cb) {
	this.vault.remove(api.createKey(value.topic, value.index), api.shard(value), cb);
};
