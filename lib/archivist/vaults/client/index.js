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
	if (shard === true || shard === '*') {
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
			if (shard[i] === true || shard[i] === '*' || '' + shard[i] === session.actorId) {
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


function emit(vault, event, actorIds, msg) {
	if (!vault.state || !actorIds || !msg) {
		return;
	}

	if (actorIds === '*') {
		vault.logger.verbose('Broadcasting "' + event + '" to all logged in users');

		vault.state.broadcast(event, msg);
	} else {
		vault.logger.verbose('Emitting "' + event + '" to', actorIds);

		vault.state.emitToActors(actorIds, event, msg);
	}
}


ClientVault.prototype.set = function (actorIds, key, data, expirationTime) {
	emit(
		this,
		'archivist:set',
		actorIds,
		{ key: key, value: data, expirationTime: expirationTime }
	);
};


ClientVault.prototype.applyDiff = function (actorIds, key, diff, expirationTime) {
	emit(
		this,
		'archivist:applyDiff',
		actorIds,
		{ key: key, diff: diff, expirationTime: expirationTime }
	);
};


ClientVault.prototype.touch = function (actorIds, key, expirationTime) {
	emit(
		this,
		'archivist:touch',
		actorIds,
		{ key: key, expirationTime: expirationTime }
	);
};


ClientVault.prototype.del = function (actorIds, key) {
	emit(
		this,
		'archivist:del',
		actorIds,
		{ key: key }
	);
};
