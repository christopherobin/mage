// based on node-couchbase, this vault supports sharding
//
// key format: string
//
// references:
// -----------
// node-couchbase:     https://github.com/couchbase/couchnode
// libcouchbase:       https://github.com/couchbase/libcouchbase


var Archive = require('./Archive');


exports.defaultTopicApi = require('./defaultTopicApi');


// Vault wrapper around node-couchbase

function CouchbaseVault(name, logger) {
	// required exposed properties

	this.name = name;                  // the unique vault name
	this.archive = new Archive(this);  // archivist bindings

	this.client = null;                // node-couchbase bucket
	this.logger = logger;
}


exports.create = function (name, logger) {
	return new CouchbaseVault(name, logger);
};


CouchbaseVault.prototype.setup = function (cfg, cb) {
	var couchbase = require('couchbase');
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


CouchbaseVault.prototype.close = function () {
	this.logger.verbose('Closing vault:', this.name);

	if (this.client) {
		this.client.shutdown();
		this.client = null;
	}
};


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


CouchbaseVault.prototype.createItem = function (key, hashkey) {
	key = this._prefix(key);

	return hashkey ? { key: key, hashkey: hashkey + '' } : key;
};


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


CouchbaseVault.prototype.add = function (key, hash, data, expirationTime, cb) {
	var item = this.createItem(key, hash);

	this.logger.verbose('add:', item);

	var meta = {};

	if (expirationTime) {
		meta.expiry = expirationTime;
	}

	this.client.add(item, data, meta, cb);
};


CouchbaseVault.prototype.set = function (key, hash, data, expirationTime, cb) {
	var item = this.createItem(key, hash);

	this.logger.verbose('set:', item);

	var meta = {};

	if (expirationTime) {
		meta.expiry = expirationTime;
	}

	this.client.set(item, data, meta, cb);
};


CouchbaseVault.prototype.touch = function (key, hash, expirationTime, cb) {
	var item = this.createItem(key, hash);

	this.logger.verbose('touch:', item);

	this.client.touch(item, expirationTime, cb);
};


CouchbaseVault.prototype.remove = function (key, hash, cb) {
	var item = this.createItem(key, hash);

	this.logger.verbose('remove:', item);

	this.client.remove(item, cb);
};
