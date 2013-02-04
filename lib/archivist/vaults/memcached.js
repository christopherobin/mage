// based on node-memcached, this vault does not support sharding
//
// key format: string
// shard format: not allowed (falsy expected)
//
// references:
// -----------
// node-memcached:     https://github.com/3rd-Eden/node-memcached
// memcached protocol: https://github.com/memcached/memcached/blob/master/doc/protocol.txt


// default topic/index/data handlers

exports.defaultTopicApis = {
	serialize: function (value) {
		// throws exceptions on failure

		return value.setEncoding(['utf8', 'buffer']).data;
	},
	deserialize: function (data, value) {
		var mediaType, encoding;

		if (Buffer.isBuffer(data)) {
			mediaType = 'application/octet-stream';
			encoding = 'buffer';
		} else if (typeof data === 'string') {
			mediaType = 'application/json';
			encoding = 'utf8';
		} else {
			mediaType = 'application/json';
			encoding = 'live';
		}

		value.initWithData(mediaType, data, encoding);
	},
	key: function (value) {
		// eg: weapons/actorId:123/bag:main
		// eg: weapons/guildId:123

		var key = value.topic, props, i;

		if (value.index) {
			props = Object.keys(value.index);
			props.sort();

			for (i = 0; i < props.length; i++) {
				key += '/' + props[i] + ':' + value.index[props[i]];
			}
		}

		return key;
	}
};


// Archivist bindings into the MemcachedVault API

function Archive(vault) {
	this.vault = vault;
}


Archive.prototype.read = function (api, value, cb) {
	this.vault.get(api.key(value), function (error, data) {
		if (error) {
			return cb(error);
		}

		if (data !== undefined) {
			api.deserialize(data, value);
		}

		cb();
	});
};


Archive.prototype.create = function (api, value, cb) {
	this.vault.set(api.key(value), api.serialize(value), value.ttl, cb);
};


Archive.prototype.update = function (api, value, cb) {
	this.vault.set(api.key(value), api.serialize(value), value.ttl, cb);
};


Archive.prototype.touch = function (api, value, cb) {
	this.vault.touch(api.key(value), value.ttl, cb);
};


Archive.prototype.del = function (api, value, cb) {
	this.vault.del(api.key(value), cb);
};


// Vault wrapper around node-memcached

function MemcachedVault(name) {
	// required exposed properties

	this.name = name;                  // the unique vault name
	this.archive = new Archive(this);  // archivist bindings

	this.client = null;                // node-memcached instance
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

MemcachedVault.prototype.get = function (key, cb) {
	this.client.get(this._prefix(key), function (error, data) {
		if (error) {
			return cb(error);
		}

		// handle a special case in node-memcached, where it returns "false" as an indicator
		// for non-existence

		if (data === false) {
			data = undefined;
		}

		cb(null, data);
	});
};


MemcachedVault.prototype.set = function (key, data, ttl, cb) {
	this.client.set(this._prefix(key), data, ttl || 0, cb);
};


MemcachedVault.prototype.touch = function (key, ttl, cb) {
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


MemcachedVault.prototype.del = function (key, cb) {
	this.client.del(this._prefix(key), cb);
};
