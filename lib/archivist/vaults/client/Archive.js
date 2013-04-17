// Archivist bindings for the ClientVault API

function Archive(vault) {
	this.vault = vault;
}


module.exports = Archive;


Archive.prototype.add = function (api, value, cb) {
	// TODO: do we need a proper add?

	this.vault.set(api.shard(value), api.createKey(value.topic, value.index), api.serialize(value), value.expirationTime);

	cb();
};


Archive.prototype.set = function (api, value, cb) {
	var diff = value.getDiff();

	if (diff) {
		this.vault.applyDiff(api.shard(value), api.createKey(value.topic, value.index), diff, value.expirationTime);
	} else {
		this.vault.set(api.shard(value), api.createKey(value.topic, value.index), api.serialize(value), value.expirationTime);
	}

	cb();
};


Archive.prototype.touch = function (api, value, cb) {
	this.vault.touch(api.shard(value), api.createKey(value.topic, value.index), value.expirationTime);

	cb();
};


Archive.prototype.del = function (api, value, cb) {
	this.vault.del(api.shard(value), api.createKey(value.topic, value.index));

	cb();
};
