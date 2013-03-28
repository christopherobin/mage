var createTrueName = require('rumplestiltskin').trueName;


// key format: string
// shard format: not allowed

function MemoryData(data, mediaType, encoding, expirationTime) {
	this.data = data;
	this.mediaType = mediaType;
	this.encoding = encoding;
	this.expirationTime = expirationTime;
}


// default topic/index/data handlers

exports.defaultValueHandlers = {
	serialize: function (value) {
		// throws exceptions on failure

		value.setEncoding(['utf8', 'base64'], { pretty: false });

		return new MemoryData(value.data, value.mediaType, value.encoding, value.expirationTime);
	},
	deserialize: function (memoryData, value) {
		// throws exceptions on failure

		value.setData(memoryData.mediaType, memoryData.data, memoryData.encoding);
		value.setExpirationTime(memoryData.expirationTime);
	},
	createKey: function (topic, index) {
		return createTrueName(index, topic);
	}
};


// Archivist bindings into the MemoryVault API

function Archive(vault) {
	this.vault = vault;
}


Archive.prototype.get = function (api, value, cb) {
	this.vault.get(api.createKey(value.topic, value.index), function (error, data) {
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
	this.vault.add(api.createKey(value.topic, value.index), api.serialize(value), value.expirationTime, cb);
};


Archive.prototype.set = function (api, value, cb) {
	this.vault.set(api.createKey(value.topic, value.index), api.serialize(value), value.expirationTime, cb);
};


Archive.prototype.touch = function (api, value, cb) {
	this.vault.touch(api.createKey(value.topic, value.index), value.expirationTime, cb);
};


Archive.prototype.del = function (api, value, cb) {
	this.vault.del(api.createKey(value.topic, value.index), cb);
};


// MemoryVault

function MemoryVault(name, logger) {
	this.name = name;
	this.archive = new Archive(this);  // archivist bindings

	this.logger = logger;

	this._store = {};  // the actual data that we store
	this._timers = {}; // where we keep the expiration timers
}


exports.create = function (name, logger) {
	return new MemoryVault(name, logger);
};


MemoryVault.prototype.setup = function (cfg, cb) {
	cb();
};


MemoryVault.prototype.destroy = function () {
};


function applyTTL(memoryVault, trueName, expirationTime) {
	clearTimeout(memoryVault._timers[trueName]);

	if (memoryVault._store[trueName]) {
		memoryVault._store[trueName].expirationTime = expirationTime;
	}

	if (!expirationTime) {
		return;
	}

	var ttl = expirationTime * 1000 - new Date();

	memoryVault._timers[trueName] = setTimeout(function expire() {
		memoryVault.logger.verbose('expire:', trueName);

		delete memoryVault._store[trueName];
		delete memoryVault._timers[trueName];
	}, ttl);
}


MemoryVault.prototype.get = function (trueName, cb) {
	this.logger.verbose('get:', trueName);

	var store = this._store;

	process.nextTick(function () {

		cb(null, store[trueName]);
	});
};


MemoryVault.prototype.add = function (trueName, data, expirationTime, cb) {
	this.logger.verbose('add:', trueName);

	var that = this;

	process.nextTick(function () {
		if (that._store.hasOwnProperty(trueName)) {
			return cb(new Error('Value already exists when trying to add.'));
		}

		that._store[trueName] = data;
		applyTTL(that, trueName, expirationTime);
		cb();
	});
};


MemoryVault.prototype.set = function (trueName, data, expirationTime, cb) {
	this.logger.verbose('set:', trueName);

	var that = this;

	process.nextTick(function () {
		that._store[trueName] = data;
		applyTTL(that, trueName, expirationTime);
		cb();
	});
};


MemoryVault.prototype.touch = function (trueName, expirationTime, cb) {
	this.logger.verbose('touch:', trueName);

	var that = this;

	process.nextTick(function () {
		applyTTL(that, trueName, expirationTime);
		cb();
	});
};


MemoryVault.prototype.del = function (trueName, cb) {
	this.logger.verbose('del:', trueName);

	var store = this._store;
	var timers = this._timers;

	process.nextTick(function () {
		clearTimeout(timers[trueName]);

		delete store[trueName];
		delete timers[trueName];

		cb();
	});
};
