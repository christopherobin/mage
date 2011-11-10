var mithril = require('../mithril'),
    async = require('async'),
    Memcached = require('memcached');


var client;


function MembaseStore(state, config) {
	this.state = state;
	this.config = config;
}


exports.MembaseStore = MembaseStore;


function getClient(config) {
	if (!client) {
		Memcached.config.debug = true;

		client = new Memcached(config.hosts, config.options || {});
	}

	return client;
}


exports.getClient = getClient;


MembaseStore.prototype.connect = function () {
	return getClient(this.config);
};


MembaseStore.prototype.autoTransaction = function (rules) {
};


// closing (cleanup, we keep connections open)

MembaseStore.prototype.close = function () {
	// cleanup

	this.config = null;
	this.state = null;
};


// transaction finalizing

MembaseStore.prototype.commit = function (cb) {
	// we can do nothing
	cb();
};


MembaseStore.prototype.rollBack = function (cb) {
	// we can do nothing
	cb();
};


// queries / statement execution

MembaseStore.prototype.getOne = function (key, required, errorCode, cb) {
	var client = this.connect();
	var state = this.state;

	client.get(key, function (error, value) {
		mithril.core.logger.debug('KV: getOne ' + key);

		if (error) {
			return state.error(errorCode, { key: key, error: error }, cb);
		}

		if (required && value === undefined) {
			return state.error(errorCode, { key: key, error: 'expected a value, but received none' }, cb);
		}

		cb(null, value);
	});
};


MembaseStore.prototype.getMany = function (keys, errorCode, cb) {
	var client = this.connect();
	var state = this.state;

	client.getMulti(keys, function (error, values) {
		mithril.core.logger.debug('KV: getMany ' + keys.join(' '));

		if (error) {
			return state.error(errorCode, { keys: keys, error: error }, cb);
		}

		cb(null, values);
	});
};


MembaseStore.prototype.set = function (key, value, ttl, cb) {
	var client = this.connect();
	var state = this.state;

	if (!ttl) {
		ttl = 0;
	}

	client.set(key, value, ttl, function (error, result) {
		mithril.core.logger.debug('KV: set ' + key + ' -> ' + value);

		if (error) {
			return state.error(null, { key: key, value: value, error: error }, cb);
		}

		cb();
	});
};


MembaseStore.prototype.setMany = function (valueMap, ttl, cb) {
	var client = this.connect();
	var state = this.state;

	if (!ttl) {
		ttl = 0;
	}

	// currently not supported by node-memcached, so wrapped

	var keys = Object.keys(valueMap);

	async.forEach(
		keys,
		function (callback, key) {
			client.set(key, valueMap[key], ttl, callback);
		},
		function (error, result) {
			if (error) {
				return state.error(null, { valueMap: valueMap, error: error }, cb);
			}

			cb();
		}
	);
};


MembaseStore.prototype.inc = function (key, size, ttl, cb) {
	var client = this.connect();
	var state = this.state;

	if (!ttl) {
		ttl = 0;
	}

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

	client.decrement(key, size, ttl, function (error, result) {
		if (error) {
			return state.error(null, { key: key, size: size, error: error }, cb);
		}

		cb();
	});
};


MembaseStore.prototype.del = function (key, cb) {
	var client = this.connect();
	var state = this.state;

	client.del(key, function (error, result) {
		mithril.core.logger.debug('KV: del ' + key);

		if (error) {
			return state.error(null, { key: key, error: error }, cb);
		}

		cb();
	});
};


MembaseStore.prototype.touch = function (key, ttl, cb) {
	var client = this.connect();
	var state = this.state;

	var callback = function (error) {
		mithril.core.logger.debug('KV: touch ' + key);

		if (error) {
			return state.error(null, error, cb);
		}

		cb();
	};

	client.command(function touch(noreply) {
		return {
			command: ['touch', key, ttl].join(' '),
			key: key,
			type: 'touch',
			callback: callback
		};
	});
};


/*
MembaseStore.prototype.getMapped = function (sql, params, map, errorCode, cb) {
	var _this = this;

	this.source(true, function (error, db) {
		if (error) {
			return cb(error);
		}

		db.query(sql, params, function (error, results) {
			mithril.core.logger.debug('DB: getMapped ' + sql + ' using', params);

			if (error) {
				_this.state.error(errorCode, { sql: sql, params: params, error: error }, cb);
				return;
			}

			var out = {};

			for (var i = 0, len = results.length; i < len; i++) {
				var row = results[i];

				if (map.value) {
					if (map.type) {
						out[row[map.key]] = mithril.core.PropertyMap.unserialize(row[map.type], row[map.value]);
					} else {
						out[row[map.key]] = row[map.value];
					}
				} else {
					out[row[map.key]] = row;

					if (!map.keepKey) {
						delete row[map.key];
					}
				}
			}

			cb(null, out);
		});
	});
};
*/

