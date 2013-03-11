var mage = require('../../../mage');
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

		value.setData(memoryData.mediaType, memoryData.data, memoryData.encoding);
	},
	key: function (value) {
		return createTrueName(value.index, value.topic);
	}
};


// Archivist bindings into the MemoryVault API

function Archive(vault) {
	this.vault = vault;
}


Archive.prototype.get = function (api, value, cb) {
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


Archive.prototype.add = function (api, value, cb) {
	this.vault.add(api.key(value), api.serialize(value), cb);
};


Archive.prototype.set = function (api, value, cb) {
	this.vault.set(api.key(value), api.serialize(value), cb);
};


Archive.prototype.del = function (api, value, cb) {
	this.vault.del(api.key(value), cb);
};


// MemoryVault

function MemoryVault(name) {
	this.name = name;
	this.archive = new Archive(this);  // archivist bindings

	this.logger = mage.core.logger.context('vault:' + name);

	this._store = {};  // the actual data that we store
}


exports.create = function (name) {
	return new MemoryVault(name);
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
			return cb(new Error('Could not add already existing value in memory vault'));
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
