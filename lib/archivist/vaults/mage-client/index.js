var mage = require('../../../mage');

// this vault uses shards to aim at actors (to emit events to)
//
// key format: { topic: string, index: { .. } }
// shard format: actorId | [actorId, actorId, ..] | falsy


// default topic/index/data handlers

exports.defaultValueHandlers = {
	serialize: function (value) {
		value.setEncoding(['utf8', 'base64']);

		return {
			mediaType: value.mediaType,
			data: value.data,
			encoding: value.encoding
		};
	},
	key: function (value) {
		return { topic: value.topic, index: value.index };
	}
};


// Archivist bindings into the MageClientVault API

function Archive(vault) {
	this.vault = vault;
}


Archive.prototype.create = function (api, value, cb) {
	this.vault.write(api.shard(value), api.key(value), api.serialize(value), value.expirationTime, cb);
};


Archive.prototype.update = function (api, value, cb) {
	var diff = value.getDiff();

	if (diff) {
		this.vault.writeDiff(api.shard(value), api.key(value), diff, value.expirationTime, cb);
	} else {
		this.vault.write(api.shard(value), api.key(value), api.serialize(value), value.expirationTime, cb);
	}
};


Archive.prototype.touch = function (api, value, cb) {
	this.vault.touch(api.shard(value), api.key(value), value.expirationTime, cb);
};


Archive.prototype.del = function (api, value, cb) {
	this.vault.del(api.shard(value), api.key(value), cb);
};


// Vault wrapper around state.emit

function MageClientVault(name) {
	this.name = name;
	this.archive = new Archive(this);  // archivist bindings

	this.state = null;
	this.logger = mage.core.logger.context('vault:' + name);
}


exports.create = function (name) {
	return new MageClientVault(name);
};


MageClientVault.prototype.setup = function (cfg, cb) {
	// TODO: check for cfg sanity

	this.state = cfg.state;

	cb();
};


MageClientVault.prototype.destroy = function () {
	this.state = null;
};


MageClientVault.prototype.write = function (actorIds, key, data, expirationTime, cb) {
	if (this.state) {
		var msg = { key: key, value: data, expirationTime: expirationTime || undefined };

		this.logger.verbose('Emitting "archivist:write" to', actorIds);

		this.state.emitToActors(actorIds, 'archivist:write', msg);
	}

	cb();
};


MageClientVault.prototype.writeDiff = function (actorIds, key, diff, expirationTime, cb) {
	if (this.state) {
		var msg = { key: key, diff: diff, expirationTime: expirationTime || undefined };

		this.logger.verbose('Emitting "archivist:writeDiff" to', actorIds);

		this.state.emitToActors(actorIds, 'archivist:writeDiff', msg);
	}

	cb();
};


MageClientVault.prototype.touch = function (actorIds, key, expirationTime, cb) {
	if (this.state) {
		var msg = { key: key, expirationTime: expirationTime };

		this.logger.verbose('Emitting "archivist:touch" to', actorIds);

		this.state.emitToActors(actorIds, 'archivist:touch', msg);
	}

	cb();
};


MageClientVault.prototype.del = function (actorIds, key, cb) {
	if (this.state) {
		var msg = { key: key };

		this.logger.verbose('Emitting "archivist:del" to', actorIds);

		this.state.emitToActors(actorIds, 'archivist:del', msg);
	}

	cb();
};
