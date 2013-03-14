var createTrueName = require('rumplestiltskin').trueName;


// key format: string
// shard format: not allowed

function MemoryData(data, mediaType, encoding) {
	this.data = data;
	this.mediaType = mediaType;
	this.encoding = encoding;
}


// default topic/index/data handlers

exports.defaultValueHandlers = {
	serialize: function (value) {
		// throws exceptions on failure

		value.setEncoding(['utf8', 'base64'], { pretty: false });

		return new MemoryData(value.data, value.mediaType, value.encoding);
	},
	deserialize: function (memoryData, value) {
		// throws exceptions on failure

		value.initWithData(memoryData.mediaType, memoryData.data, memoryData.encoding);
	},
	key: function (topic, index) {
		return createTrueName(index, topic);
	}
};


// Archivist bindings into the MemoryVault API

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
	this.vault.add(api.key(value.topic, value.index), api.serialize(value), cb);
};


Archive.prototype.set = function (api, value, cb) {
	this.vault.set(api.key(value.topic, value.index), api.serialize(value), cb);
};


Archive.prototype.del = function (api, value, cb) {
	this.vault.del(api.key(value.topic, value.index), cb);
};


// MemoryVault

function MemoryVault(name, logger) {
	this.name = name;
	this.archive = new Archive(this);  // archivist bindings

	this.logger = logger;

	this._store = {};  // the actual data that we store
}


exports.create = function (name, logger) {
	return new MemoryVault(name, logger);
};


MemoryVault.prototype.setup = function (cfg, cb) {
	cb();
};


MemoryVault.prototype.destroy = function () {
};


MemoryVault.prototype.get = function (trueName, cb) {
	this.logger.verbose('get:', trueName);

	var store = this._store;

	process.nextTick(function () {
		cb(null, store[trueName]);
	});
};


MemoryVault.prototype.add = function (trueName, data, cb) {
	this.logger.verbose('add:', trueName);

	var store = this._store;

	process.nextTick(function () {
		if (store.hasOwnProperty(trueName)) {
			return cb();
		}

		store[trueName] = data;
		cb();
	});
};


MemoryVault.prototype.set = function (trueName, data, cb) {
	this.logger.verbose('set:', trueName);

	var store = this._store;

	process.nextTick(function () {
		store[trueName] = data;
		cb();
	});
};


MemoryVault.prototype.del = function (trueName, cb) {
	this.logger.verbose('del:', trueName);

	var store = this._store;

	process.nextTick(function () {
		delete store[trueName];
		cb();
	});
};
