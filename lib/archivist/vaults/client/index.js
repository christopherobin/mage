// this vault uses shards to aim at actors (to emit events to)
//
// key format: { topic: string, index: { .. } }
// shard format: actorId | [actorId, actorId, ..] | falsy

var Archive = require('./Archive');


// default topic/index/data handlers

exports.defaultTopicApi = require('./defaultTopicApi');


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
	this.state = cfg.state;

	setImmediate(cb);
};


ClientVault.prototype.close = function () {
	this.logger.verbose('Closing vault:', this.name);

	this.state = null;
};


ClientVault.prototype.readAllowedForSession = function (session, shard) {
	if (shard === true) {
		return true;
	}

	if (!session) {
		return false;
	}

	if (session.meta && session.meta.access === 'admin') {
		return true;
	}

	if (!shard) {
		return false;
	}

	if (Array.isArray(shard)) {
		// loop instead of indexOf, because we want to cast the array elemenets to strings

		for (var i = 0; i < shard.length; i++) {
			if (shard[i] === true || '' + shard[i] === session.actorId) {
				return true;
			}
		}

		return false;
	}

	if ('' + shard === session.actorId) {
		return true;
	}

	return false;
};


ClientVault.prototype.set = function (actorIds, key, data, expirationTime) {
	var state = this.state;

	if (state) {
		var msg = { key: key, value: data, expirationTime: expirationTime };

		this.logger.verbose('Emitting "archivist:set" to', actorIds);

		state.emitToActors(actorIds, 'archivist:set', msg);
	}
};


ClientVault.prototype.applyDiff = function (actorIds, key, diff, expirationTime) {
	var state = this.state;

	if (state) {
		var msg = { key: key, diff: diff, expirationTime: expirationTime };

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
