// based on node-memcached, this vault does not support sharding
//
// key format: string
//
// references:
// -----------
// node-memcached:     https://github.com/3rd-Eden/node-memcached
// memcached protocol: https://github.com/memcached/memcached/blob/master/doc/protocol.txt


// default topic/index/data handlers

exports.defaultValueHandlers = {
	serialize: function (value) {
		// throws exceptions on failure

		return value.setEncoding(['live']).data;
	},
	deserialize: function (data, value) {
		// let mediaType be detected by the VaultValue

		value.setData(null, data, 'live');
	},
	key: function (topic, index) {
		// eg: weapons/actorId:123/bag:main
		// eg: weapons/guildId:123

		var key = topic, props, i;

		if (index) {
			props = Object.keys(index);
			props.sort();

			for (i = 0; i < props.length; i++) {
				key += '/' + props[i] + ':' + index[props[i]];
			}
		}

		return key;
	}
};


// Archivist bindings into the MemcachedVault API

function Archive(vault) {
	this.vault = vault;
}


Archive.prototype.get = function (api, value, cb) {
	this.vault.get(api.key(value.topic, value.index), function (error, data) {
		if (error) {
			return cb(error);
		}

		if (data !== undefined) {
			api.deserialize(data, value);
		}

		cb();
	});
};


Archive.prototype.add = function (api, value, cb) {
	this.vault.add(api.key(value.topic, value.index), api.serialize(value), value.expirationTime, cb);
};


Archive.prototype.set = function (api, value, cb) {
	this.vault.set(api.key(value.topic, value.index), api.serialize(value), value.expirationTime, cb);
};


Archive.prototype.touch = function (api, value, cb) {
	this.vault.touch(api.key(value.topic, value.index), value.expirationTime, cb);
};


Archive.prototype.del = function (api, value, cb) {
	this.vault.del(api.key(value.topic, value.index), cb);
};


// Vault wrapper around node-memcached

function MemcachedVault(name, logger) {
	// required exposed properties

	this.name = name;                  // the unique vault name
	this.archive = new Archive(this);  // archivist bindings

	this.client = null;                // node-memcached instance
	this.logger = logger;
}


exports.create = function (name, logger) {
	return new MemcachedVault(name, logger);
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
	key = this._prefix(key);

	this.logger.verbose('get:', key);

	this.client.get(key, function (error, data) {
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


MemcachedVault.prototype.add = function (key, data, expirationTime, cb) {
	key = this._prefix(key);

	this.logger.verbose('add:', key);

	this.client.add(key, data, expirationTime || 0, cb);
};


MemcachedVault.prototype.set = function (key, data, expirationTime, cb) {
	key = this._prefix(key);

	this.logger.verbose('set:', key);

	this.client.set(key, data, expirationTime || 0, cb);
};


MemcachedVault.prototype.touch = function (key, expirationTime, cb) {
	key = this._prefix(key);

	this.logger.verbose('touch:', key);

	this.client.command(function touch() {
		return {
			command: ['touch', key, expirationTime || 0].join(' '),
			key: key,
			type: 'touch',
			callback: cb
		};
	});
};


MemcachedVault.prototype.del = function (key, cb) {
	key = this._prefix(key);

	this.logger.verbose('del:', key);

	this.client.del(key, cb);
};
