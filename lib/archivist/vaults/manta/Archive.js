// Archivist bindings for the MantaVault API

function Archive(vault) {
	this.vault = vault;
}


module.exports = Archive;


Archive.prototype.get = function (api, value, cb) {
	this.vault.get(api.createPath(value.topic, value.index), function (error, obj) {
		if (error) {
			return cb(error);
		}

		if (obj) {
			api.deserialize(obj, value);
		}

		cb();
	});
};


Archive.prototype.set = function (api, value, cb) {
	this.vault.set(api.createPath(value.topic, value.index), api.serialize(value), value.expirationTime, cb);
};


Archive.prototype.del = function (api, value, cb) {
	this.vault.del(api.createPath(value.topic, value.index), cb);
};
