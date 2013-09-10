// based on node-couchbase, this vault supports sharding
//
// references:
// -----------
// node-couchbase:     https://github.com/couchbase/couchnode
// libcouchbase:       https://github.com/couchbase/libcouchbase


var Archive = require('./Archive');


exports.defaultTopicApi = require('./defaultTopicApi');


/**
 * Instantiates the CouchbaseVault (only done through the create() factory function)
 *
 * @class
 * @classdesc A node-couchbase vault (with support for sharding)
 *
 * @param {string}     name   The name of the vault
 * @param {LogCreator} logger A logger instance
 */

function CouchbaseVault(name, logger) {
	// required exposed properties

	this.name = name;                  // the unique vault name
	this.archive = new Archive(this);  // archivist bindings

	this.client = null;                // node-couchbase bucket
	this.logger = logger;
}


/**
 * Factory function to create a CouchbaseVault
 *
 * @param {string}     name   The name of the vault
 * @param {LogCreator} logger A logger instance
 * @returns {CouchbaseVault}
 */

exports.create = function (name, logger) {
	return new CouchbaseVault(name, logger);
};


/**
 * Sets up the vault
 *
 * @param {Object}   cfg          Configuration
 * @param {string}   [cfg.prefix] A prefix to apply to all keys
 * @param {Object}   cfg.options  Connection options for node-couchbase
 * @param {Function} cb
 */

CouchbaseVault.prototype.setup = function (cfg, cb) {
	var couchbase;

	try {
		couchbase = require('couchbase');
	} catch (error) {
		this.logger.emergency('Could not load node-couchbase. Make sure libcouchbase is installed, then please rebuild node-couchbase.');
		return process.nextTick(function () { cb(error); });
	}

	var that = this;

	this.keyPrefix = cfg.prefix || null;

	couchbase.connect(cfg.options || {}, function (error, client) {
		if (error) {
			that.logger.alert(error, error.code);
			return cb(error);
		}

		that.client = client;

		cb();
	});
};


/**
 * Closes the connection to the Couchbase cluster
 */

CouchbaseVault.prototype.close = function () {
	this.logger.verbose('Closing vault:', this.name);

	if (this.client) {
		this.client.shutdown();
		this.client = null;
	}
};


/**
 * Prefixes a key with the configured prefix (if any)
 *
 * @param {string} key
 * @returns {string}
 * @private
 */

CouchbaseVault.prototype._prefix = function (key) {
	return this.keyPrefix ? this.keyPrefix + key : key;
};


/* unprefix will be used once we support readMany
CouchbaseVault.prototype._unprefix = function (key) {
	if (!this.keyPrefix) {
		return key;
	}

	var len = this.keyPrefix.length;

	if (key.substr(0, len) !== this.keyPrefix) {
		throw new Error('Could not unprefix key "' + key + '" with prefix "' + this.keyPrefix + '"');
	}

	return key.substr(len);
};
*/


/**
 * Returns the key, or the key with its sharding hash in a format acceptable by node-couchbase
 *
 * @param key
 * @param hashkey
 * @returns {string|{key: string, hashkey: string}}
 */

CouchbaseVault.prototype.createItem = function (key, hashkey) {
	key = this._prefix(key);

	return hashkey ? { key: key, hashkey: hashkey + '' } : key;
};

/**
 * Retrieves a document from Couchbase
 *
 * @param {string}   key    The key to query
 * @param {string}   [hash] An optional hash to shard with
 * @param {Function} cb
 */

CouchbaseVault.prototype.get = function (key, hash, cb) {
	var item = this.createItem(key, hash);

	this.logger.verbose('get:', item);

	this.client.get(item, function (error, data) {
		// node-couchbase will yield error "No such key" if the key wasn't found, but we just want
		// to return undefined in that case.

		if (error) {
			if (error.code === 13 || error.message !== 'No such key') {
				return cb();
			}

			return cb(error);
		}

		if (!data) {
			data = undefined;
		}

		cb(null, data);
	});
};


/**
 * Writes a document to Couchbase if the key does not yet exist
 *
 * @param {string}   key              The key to write
 * @param {string}   [hash]           An optional hash to shard with
 * @param {*}        data             Data, preferably in its live encoding (which the default serializer provides)
 * @param {number}   [expirationTime] Optional unix timestamp at which to expire the document
 * @param {Function} cb
 */

CouchbaseVault.prototype.add = function (key, hash, data, expirationTime, cb) {
	var item = this.createItem(key, hash);

	this.logger.verbose('add:', item);

	var meta = {};

	if (expirationTime) {
		meta.expiry = expirationTime;
	}

	this.client.add(item, data, meta, cb);
};


/**
 * (Over)writes a document to Couchbase
 *
 * @param {string}   key              The key to write
 * @param {string}   [hash]           An optional hash to shard with
 * @param {*}        data             Data, preferably in its live encoding (which the default serializer provides)
 * @param {number}   [expirationTime] Optional unix timestamp at which to expire the document
 * @param {Function} cb
 */

CouchbaseVault.prototype.set = function (key, hash, data, expirationTime, cb) {
	var item = this.createItem(key, hash);

	this.logger.verbose('set:', item);

	var meta = {};

	if (expirationTime) {
		meta.expiry = expirationTime;
	}

	this.client.set(item, data, meta, cb);
};


/**
 * Updates the expiration time on a document
 *
 * @param {string}   key            The key to update the expiration time of
 * @param {string}   [hash]         An optional hash to shard with
 * @param {number}   expirationTime Unix timestamp at which to expire the document
 * @param {Function} cb
 */

CouchbaseVault.prototype.touch = function (key, hash, expirationTime, cb) {
	var item = this.createItem(key, hash);

	this.logger.verbose('touch:', item);

	this.client.touch(item, expirationTime, cb);
};


/**
 * Removes a document from Couchbase
 *
 * @param {string}   key    The key to remove
 * @param {string}   [hash] An optional hash to shard with
 * @param {Function} cb
 */

CouchbaseVault.prototype.remove = function (key, hash, cb) {
	var item = this.createItem(key, hash);

	this.logger.verbose('remove:', item);

	this.client.remove(item, cb);
};
