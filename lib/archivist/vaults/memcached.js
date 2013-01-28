// based on node-memcached, this vault does not support sharding
//
// key format: string
// shard format: not allowed (falsy expected)
//
// references:
// -----------
// node-memcached:     https://github.com/3rd-Eden/node-memcached
// memcached protocol: https://github.com/memcached/memcached/blob/master/doc/protocol.txt

var Value = require('../value').Value;


function MemcachedVault(name) {
	this.name = name;
	this.client = null;
}


exports.create = function (name) {
	return new MemcachedVault(name);
};


MemcachedVault.prototype.setup = function (cfg, cb) {
	var Memcached = require('memcached');

	// TODO: check for cfg sanity

	this.client = new Memcached(cfg.servers, cfg.options);
	this.keyPrefix = cfg.prefix || null;

	// TODO: register error handlers for re-emission

	cb();
};


MemcachedVault.prototype.destroy = function () {
	if (this.client) {
		this.client.end();
		this.client = null;
	}
};


function serialize(value) {
	// throws exceptions on failure

	return value.setEncoding(['utf8', 'buffer']).data;
}


function deserialize(data) {
	// throws exceptions on failure

	if (Buffer.isBuffer(data)) {
		return new Value('application/octet-stream', data, 'buffer');
	}

	if (typeof data === 'string') {
		return new Value('application/json', data, 'utf8');
	}

	// just in case node-memcached ran JSON.parse on our value
	return new Value('application/json', data, 'live');
}


MemcachedVault.prototype._prefix = function (key) {
	return this.keyPrefix ? this.keyPrefix + key : key;
};

/* unprefix will be used once we support readMany
MemcachedVault.prototype._unprefix = function (key) {
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

MemcachedVault.prototype.generateKey = function (topic, vars) {
	// eg: weapons/actorId:123/bag:main
	// eg: weapons/guildId:123

	var key = topic, props, i;

	if (vars) {
		props = Object.keys(vars);
		props.sort();

		for (i = 0; i < props.length; i++) {
			key += '/' + props[i] + ':' + vars[props[i]];
		}
	}

	return key;
};


MemcachedVault.prototype.read = function (key, shard, cb) {
	if (shard) {
		return cb(new Error('MemcachedVault does not support sharding'));
	}

	key = this._prefix(key);

	this.client.get(key, function (error, data) {
		if (error) {
			return cb(error);
		}

		if (data === undefined || data === false) {
			return cb(null, undefined);
		}

		var value;

		try {
			value = deserialize(data);
		} catch (e) {
			return cb(e);
		}

		cb(null, value);
	});
};


MemcachedVault.prototype.create = function (key, shard, value, ttl, cb) {
	if (shard) {
		return cb(new Error('MemcachedVault does not support sharding'));
	}

	try {
		key = this._prefix(key);
		value = serialize(value);
	} catch (e) {
		return cb(e);
	}

	this.client.set(key, value, ttl || 0, cb);
};


MemcachedVault.prototype.update = function (key, shard, value, ttl, cb) {
	if (shard) {
		return cb(new Error('MemcachedVault does not support sharding'));
	}

	try {
		key = this._prefix(key);
		value = serialize(value);
	} catch (e) {
		return cb(e);
	}

	this.client.set(key, value, ttl || 0, cb);
};


MemcachedVault.prototype.touch = function (key, shard, ttl, cb) {
	// touch is for non-dirty or unloaded TTL changes

	if (shard) {
		return cb(new Error('MemcachedVault does not support sharding'));
	}

	key = this._prefix(key);

	this.client.command(function touch() {
		return {
			command: ['touch', key, ttl || 0].join(' '),
			key: key,
			type: 'touch',
			callback: cb
		};
	});
};


MemcachedVault.prototype.del = function (key, shard, cb) {
	if (shard) {
		return cb(new Error('MemcachedVault does not support sharding'));
	}

	key = this._prefix(key);

	this.client.del(key, cb);
};

