// Archivist bindings for the RedisVault API

function Archive(vault) {
	this.vault = vault;
}


module.exports = Archive;


Archive.prototype.get = function (api, value, cb) {
	this.vault.get(api.createKey(value.topic, value.index), function (error, data) {
		if (error) {
			return cb(error);
		}

		if (data !== undefined && data !== null) {
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
