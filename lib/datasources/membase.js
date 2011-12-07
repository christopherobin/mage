var mithril = require('../mithril'),
    async = require('async'),
    Memcached = require('memcached'),
    MemcachedTransaction = require('memcached-transactions');


var client;


function MembaseStore(state, config) {
	this.state = state;
	this.config = config;
	this.prefix = config.prefix ? config.prefix + '/' : null;
}


exports.MembaseStore = MembaseStore;


function getClient(config) {
	if (!client) {
		client = new Memcached(config.hosts, config.options || {});
	}

	return client;
}


exports.getClient = getClient;


MembaseStore.prototype.connect = function () {
	if (!this.tr) {
		this.tr = new MemcachedTransaction(getClient(this.config, { debug: true }));
	}

	return this.tr;
};


MembaseStore.prototype.autoTransaction = function (rules) {
	// not implemented, we always behave transactional
};


// closing (cleanup, we keep connections open)

MembaseStore.prototype.close = function () {
	// cleanup

	this.config = null;
	this.state = null;
	this.tr = null;
};


// transaction finalizing

MembaseStore.prototype.commit = function (cb) {
	this.connect().commit(cb);
};


MembaseStore.prototype.rollBack = function (cb) {
	this.connect().rollBack(cb);
};


// key sanitizing

MembaseStore.prototype.prefixKey = function (key) {
	return this.prefix ? this.prefix + key : key;
};


MembaseStore.prototype.prefixKeys = function (keys) {
	if (!this.prefix) {
		return keys;
	}

	var len = keys.length;
	var newkeys = new Array(len);

	for (var i = 0; i < len; i++) {
		newkeys[i] = this.prefix + keys[i];
	}

	return newkeys;
};


MembaseStore.prototype.unprefixKey = function (key) {
	if (!this.prefix) {
		return key;
	}

	return key.slice(this.prefix.length);
};


MembaseStore.prototype.unprefixKeys = function (keys) {
	if (!this.prefix) {
		return keys;
	}

	var len = keys.length;
	var newkeys = new Array(len);
	var prefixLength = this.prefix.length;

	for (var i = 0; i < len; i++) {
		newkeys[i] = keys[i].slice(prefixLength);
	}

	return newkeys;
};


MembaseStore.prototype.prefixMap = function (map) {
	if (!this.prefix) {
		return map;
	}

	var newmap = {};

	for (var key in map) {
		newmap[this.prefix + key] = map[key];
	}

	return newmap;
};


MembaseStore.prototype.unprefixMap = function (map) {
	if (!this.prefix) {
		return map;
	}

	var newmap = {};
	var prefixLength = this.prefix.length;

	for (var key in map) {
		newmap[key.slice(prefixLength)] = map[key];
	}

	return newmap;
};



// queries / statement execution

MembaseStore.prototype.getOne = function (key, required, errorCode, cb) {
	var client = this.connect();
	var state = this.state;

	key = this.prefixKey(key);

	client.get(key, function (error, value) {
		mithril.core.logger.debug('KV: getOne', key);

		if (error) {
			return state.error(errorCode, { key: key, error: error }, cb);
		}

		if (required && !value) {	// can be undefined (node-memcached-transactions) or false (node-memcached)
			return state.error(errorCode, { key: key, error: 'expected a value, but received none' }, cb);
		}

		cb(null, value);
	});
};


MembaseStore.prototype.getMany = function (keys, errorCode, cb) {
	var client = this.connect();
	var state = this.state;

	keys = this.prefixKeys(keys);
	var that = this;

	client.getMulti(keys, function (error, values) {
		mithril.core.logger.debug('KV: getMany', keys.join(' '));

		if (error) {
			return state.error(errorCode, { keys: keys, error: error }, cb);
		}

		cb(null, that.unprefixMap(values));
	});
};


MembaseStore.prototype.set = function (key, value, ttl) {
	var client = this.connect();

	key = this.prefixKey(key);

	mithril.core.logger.debug('KV: set', key, '->', value);

	client.set(key, value, ttl || 0);
};


MembaseStore.prototype.setMany = function (valueMap, ttl) {
	var client = this.connect();

	if (!ttl) {
		ttl = 0;
	}

	// currently not supported by node-memcached, so wrapped

	valueMap = this.prefixMap(valueMap);

	for (var key in valueMap) {
		var value = valueMap[key];

		mithril.core.logger.debug('KV: set(Many)', key, '->', value);

		client.set(key, value, ttl || 0);
	}
};

/*
MembaseStore.prototype.inc = function (key, size, ttl, cb) {
	var client = this.connect();
	var state = this.state;

	if (!ttl) {
		ttl = 0;
	}

	key = this.prefixKey(key);

	client.increment(key, size, ttl, function (error, result) {
		if (error) {
			return state.error(null, { key: key, size: size, error: error }, cb);
		}

		cb();
	});
};


MembaseStore.prototype.dec = function (key, size, ttl, cb) {
	var client = this.connect();
	var state = this.state;

	if (!ttl) {
		ttl = 0;
	}

	key = this.prefixKey(key);

	client.decrement(key, size, ttl, function (error, result) {
		if (error) {
			return state.error(null, { key: key, size: size, error: error }, cb);
		}

		cb();
	});
};
*/

MembaseStore.prototype.del = function (key) {
	var client = this.connect();

	key = this.prefixKey(key);

	mithril.core.logger.debug('KV: del ', key);

	client.del(key);
};


MembaseStore.prototype.delMany = function (keys) {
	// not implemented, so simulated

	var client = this.connect();

	keys = this.prefixKeys(keys);

	for (var i = 0, len = keys.length; i < len; i++) {
		var key = keys[i];

		mithril.core.logger.debug('KV: del(Many) ', key);

		client.del(key);
	}
};


MembaseStore.prototype.touch = function (key, ttl) {
	var client = this.connect();

	key = this.prefixKey(key);

	mithril.core.logger.debug('KV: touch', key);

	client.touch(key, ttl || 0);
};

