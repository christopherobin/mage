// this vault uses shards to aim at actors (to emit events to)
//
// key format: { topic: string, vars: VarsObject }
// shard format: actorId | [actorId, actorId, ..] | falsy


function MageClientVault(name) {
	this.name = name;
	this.state = null;
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


function serialize(key, ttl, value, allowDiff) {
	var data, diff, mediaType, encoding;

	if (value) {
		if (allowDiff) {
			diff = value.getDiff();
		}

		if (!diff) {
			value.setEncoding(['utf8', 'base64']);

			data = value.data;
			mediaType = value.mediaType;
			encoding = value.encoding;
		}
	}

	return JSON.stringify({
		key: key,
		ttl: ttl || undefined,
		data: data,
		diff: diff,
		mediaType: mediaType,
		encoding: encoding
	});
}


MageClientVault.prototype.generateKey = function (topic, vars) {
	return { topic: topic, vars: vars };
};


MageClientVault.prototype.emitEvent = function (actorIds, evtName, key, ttl, value, cb) {
	// this is a helper-method, but may be used outside to accomodate syncing between client/server

	if (!this.state || !actorIds) {
		return cb();
	}

	var allowDiff = (evtName === 'update');

	try {
		this.state.emitToActors(actorIds, 'archivist:' + evtName, serialize(key, ttl, value, allowDiff), null, true);
	} catch (error) {
		return cb(error);
	}

	cb();
};


MageClientVault.prototype.create = function (key, actorIds, value, ttl, cb) {
	this.emitEvent(actorIds, 'create', key, ttl, value, cb);
};


MageClientVault.prototype.update = function (key, actorIds, value, ttl, cb) {
	this.emitEvent(actorIds, 'update', key, ttl, value, cb);
};


MageClientVault.prototype.touch = function (key, actorIds, ttl, cb) {
	this.emitEvent(actorIds, 'touch', key, ttl, undefined, cb);
};


MageClientVault.prototype.del = function (key, actorIds, cb) {
	this.emitEvent(actorIds, 'del', key, undefined, undefined, cb);
};

