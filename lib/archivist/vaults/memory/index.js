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

		value.initWithData(memoryData.mediaType, memoryData.data, memoryData.encoding);
	},
	key: function (value) {
		return createTrueName(value.index, value.topic);
	}
};


// Archivist bindings into the MemoryVault API

function Archive(vault) {
	this.vault = vault;
}


Archive.prototype.read = function (api, value, cb) {
	this.vault.read(api.key(value), function (error, data) {
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
	this.vault.write(api.key(value), api.serialize(value), cb);
};


Archive.prototype.update = function (api, value, cb) {
	this.vault.write(api.key(value), api.serialize(value), cb);
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


MemoryVault.prototype.read = function (trueName, cb) {
	this.logger.verbose('read:', trueName);

	var store = this._store;

	process.nextTick(function () {
		cb(null, store[trueName]);
	});
};


MemoryVault.prototype.write = function (trueName, data, cb) {
	this.logger.verbose('write:', trueName);

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
