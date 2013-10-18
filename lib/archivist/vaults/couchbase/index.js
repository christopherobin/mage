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

		return process.nextTick(function () {
			cb(error);
		});
	}

	var that = this;

	this.keyPrefix = cfg.prefix || null;
	this.flagStyle = cfg.flagStyle || 'default';

	this.client = new couchbase.Connection(cfg.options || {}, function (error) {
		if (error) {
			that.logger.alert.data('options', cfg.options).log('Error while connecting:', error, '(code: ' + error.code + ')');
			return cb(error);
		}

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


/**
 * Retrieves a document from Couchbase
 *
 * @param {string}   key               The key to query
 * @param {object}   [options]         Options for this operation
 * @param {string}   [options.hashkey] Hashkey to shard on
 * @param {number}   [options.expiry]  A unix timestamp to update expiration with (get-and-touch pattern)
 * @param {Function} cb                Receives error, data, cas, flags
 */

CouchbaseVault.prototype.get = function (key, options, cb) {
	key = this._prefix(key);

	this.logger.verbose('get:', key, 'options:', options);

	this.client.get(key, options, function (error, data, cas, flags) {
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

		cb(null, data, cas, flags);
	});
};


/**
 * Writes a document to Couchbase if the key does not yet exist
 *
 * @param {string}   key               The key to write
 * @param {*}        data              Data to store
 * @param {object}   [options]         Options for this operation
 * @param {string}   [options.hashkey] Hashkey to shard on
 * @param {number}   [options.expiry]  A unix timestamp to set expiration to
 * @param {number}   [options.flags]   Uint32 flags to identify the mediaType
 * @param {Function} cb
 */

CouchbaseVault.prototype.add = function (key, data, options, cb) {
	key = this._prefix(key);

	this.logger.verbose('add:', key, 'options:', options);

	this.client.add(key, data, options, cb);
};


/**
 * (Over)writes a document to Couchbase
 *
 * @param {string}   key               The key to write
 * @param {*}        data              Data to store
 * @param {object}   [options]         Options for this operation
 * @param {string}   [options.hashkey] Hashkey to shard on
 * @param {number}   [options.expiry]  A unix timestamp to set expiration to
 * @param {number}   [options.flags]   Uint32 flags to identify the mediaType
 * @param {Function} cb
 */

CouchbaseVault.prototype.set = function (key, data, options, cb) {
	key = this._prefix(key);

	this.logger.verbose('set:', key, 'options:', options);

	this.client.set(key, data, options, cb);
};


/**
 * Updates the expiration time on a document
 *
 * @param {string}   key               The key to touch
 * @param {object}   options           Options for this operation
 * @param {string}   [options.hashkey] Hashkey to shard on
 * @param {number}   options.expiry    A unix timestamp to update expiration with
 * @param {Function} cb
 */

CouchbaseVault.prototype.touch = function (key, options, cb) {
	key = this._prefix(key);

	this.logger.verbose('touch:', key, 'options:', options);

	// known issue: touch() is broken on couchnode up to and including v1.0.1
	this.client.touch(key, options, cb);
};


/**
 * Removes a document from Couchbase
 *
 * @param {string}   key               The key to remove
 * @param {object}   options           Options for this operation
 * @param {string}   [options.hashkey] Hashkey to shard on
 * @param {Function} cb
 */

CouchbaseVault.prototype.remove = function (key, options, cb) {
	key = this._prefix(key);

	this.logger.verbose('remove:', key, 'options:', options);

	this.client.remove(key, options, cb);
};
