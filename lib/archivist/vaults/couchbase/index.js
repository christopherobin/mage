// based on node-couchbase, this vault supports sharding
//
// references:
// -----------
// node-couchbase:     https://github.com/couchbase/couchnode
// libcouchbase:       https://github.com/couchbase/libcouchbase


var Archive = require('./Archive');


exports.defaultTopicApi = require('./defaultTopicApi');


/**
 * Removes properties that are undefined. That makes node-couchbase happy. Hopefully some day, they
 * won't be as strict with undefined.
 *
 * @param {Object} obj
 */

function wash(obj) {
	if (!obj) {
		return obj;
	}

	var keys = Object.keys(obj);
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];

		if (obj[key] === undefined) {
			delete obj[key];
		}
	}

	return obj;
}


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
		this.logger.emergency('Could not load node-couchbase.', error);

		return process.nextTick(function () {
			cb(error);
		});
	}

	var that = this;

	this.keyPrefix = cfg.prefix || null;
	this.flagStyle = cfg.flagStyle || 'default';

	if (this.flagStyle !== 'default' && this.flagStyle !== 'node-memcached') {
		var err = new Error('Unknown flagStyle: "' + this.flagStyle + '" (available: "default", "node-memcached")');
		this.logger.emergency(err);
		return cb(err);
	}

	this.logger.debug('Setting up couchbase vault, using flagStyle', this.flagStyle);

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

	this.client.get(key, wash(options), function (error, result) {
		// node-couchbase will yield error "No such key" if the key wasn't found, but we just want
		// to return undefined in that case.

		if (error) {
			if (error.code === 13 || error.message !== 'No such key') {
				return cb();
			}

			return cb(error);
		}

		if (!result) {
			return cb();
		}

		cb(null, result.value, result.cas, result.flags);
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

	this.client.add(key, data, wash(options), cb);
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

	this.client.set(key, data, wash(options), function (error) {
		cb(error);
	});
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

	this.client.touch(key, wash(options), cb);
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

	this.client.remove(key, wash(options), cb);
};


/**
 * Returns an array of all applied migration versions.
 * It also ensures the table for schema migrations exists.
 *
 * @param {Function} cb  Called upon completion, and given the array of versions.
 */

CouchbaseVault.prototype.getMigrations = function (cb) {
	this.logger.debug('Loading applied migrations list');

	this.get('schema_migrations', {}, function (error, value) {
		if (error) {
			return cb(error);
		}

		var versions = Object.keys(value || {});
		return cb(null, versions);
	});
};


/**
 * Stores a version in the schema migrations key.
 *
 * @param {string}   version  The version of this migration.
 * @param {*}        report   A report that will be JSON stringified.
 * @param {Function} cb       Called upon completion.
 */

CouchbaseVault.prototype.registerMigration = function (version, report, cb) {
	var that = this;

	that.get('schema_migrations', {}, function (error, value) {
		if (error) {
			return cb(error);
		}

		var versionObjects = value || {};

		// Check if the provided version already exists
		if (versionObjects[version]) {
			return cb(new Error('Version "' + version + '" already exists!'));
		}

		// Add version to object
		versionObjects[version] = {
			version: version,
			migratedAt: parseInt(Date.now() / 1000, 10),
			report: report ? JSON.stringify(report) : ''
		};

		// Set the new migration version data
		that.set('schema_migrations', versionObjects, null, cb);
	});
};


/**
 * Removes a version from the schema migrations key.
 *
 * @param {string}   version  The version of this migration.
 * @param {Function} cb       Called upon completion.
 */

CouchbaseVault.prototype.unregisterMigration = function (version, cb) {
	var that = this;

	that.get('schema_migrations', {}, function (error, value) {
		if (error) {
			return cb(error);
		}

		var versionObjects = value || {};

		// If the version doesnt exist return an error
		if (!versionObjects[version]) {
			return cb(new Error('Version "' + version + '" does not exist!'));
		}

		// Otherwise delete the version from the version data
		delete versionObjects[version];

		// Set the new migration version data
		that.set('schema_migrations', versionObjects, null, cb);
	});
};