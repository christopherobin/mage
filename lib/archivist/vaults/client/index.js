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
	createKey: function (topic, index) {
		return { topic: topic, index: index };
	}
};


// Archivist bindings into the ClientVault API

function Archive(vault) {
	this.vault = vault;
}


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


// Vault wrapper around state.emit

function ClientVault(name, logger) {
	this.name = name;
	this.archive = new Archive(this);  // archivist bindings

	this.state = null;
	this.logger = logger;
}


exports.create = function (name, logger) {
	return new ClientVault(name, logger);
};


ClientVault.prototype.setup = function (cfg, cb) {
	// TODO: check for cfg sanity

	this.state = cfg.state;

	cb();
};


ClientVault.prototype.destroy = function () {
	this.state = null;
};


ClientVault.prototype.readAllowedForSession = function (session, shard) {
	if (shard === true) {
		return true;
	}

	if (!session) {
		return false;
	}

	if (session.meta && session.meta.isAdmin) {
		return true;
	}

	if (Array.isArray(shard)) {
		// loop instead of indexOf, because we want to cast the array elemenets to strings

		for (var i = 0; i < shard.length; i++) {
			if ('' + shard[i] === session.actorId) {
				return true;
			}
		}
	}

	if ('' + shard === session.actorId) {
		return true;
	}

	return false;
};


ClientVault.prototype.set = function (actorIds, key, data, expirationTime) {
	var state = this.state;

	if (state) {
		var msg = { key: key, value: data, expirationTime: expirationTime || undefined };

		this.logger.verbose('Emitting "archivist:set" to', actorIds);

		state.emitToActors(actorIds, 'archivist:set', msg);
	}
};


ClientVault.prototype.applyDiff = function (actorIds, key, diff, expirationTime) {
	var state = this.state;

	if (state) {
		var msg = { key: key, diff: diff, expirationTime: expirationTime || undefined };

		this.logger.verbose('Emitting "archivist:applyDiff" to', actorIds);

		state.emitToActors(actorIds, 'archivist:applyDiff', msg);
	}
};


ClientVault.prototype.touch = function (actorIds, key, expirationTime) {
	var state = this.state;

	if (state) {
		var msg = { key: key, expirationTime: expirationTime };

		this.logger.verbose('Emitting "archivist:touch" to', actorIds);

		state.emitToActors(actorIds, 'archivist:touch', msg);
	}
};


ClientVault.prototype.del = function (actorIds, key) {
	var state = this.state;

	if (state) {
		var msg = { key: key };

		this.logger.verbose('Emitting "archivist:del" to', actorIds);

		state.emitToActors(actorIds, 'archivist:del', msg);
	}
};
