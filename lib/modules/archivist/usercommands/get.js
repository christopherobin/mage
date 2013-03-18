exports.params = ['topic', 'index', 'options'];


function actorHasAccess(session, shard) {
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
}


exports.execute = function (state, topic, index, options, cb) {
	var clientVault = state.archivist.getWriteVault('client');
	if (!clientVault) {
		return state.error(null, 'No client vault found.', cb);
	}

	var valueHandler = state.archivist.getValueHandler(clientVault.name, topic);
	if (!valueHandler) {
		return state.error(null, 'Unable to load value handler on client vault for topic: ' + topic, cb);
	}

	state.archivist.getValue(topic, index, options, function (error, value) {
		if (error) {
			return cb(error);
		}

		if (!value || value.data === undefined) {
			return cb();
		}

		var allowedActors, key, serialized;

		try {
			allowedActors = valueHandler.shard(value);
			key = valueHandler.createKey(value.topic, value.index);
			serialized = valueHandler.serialize(value);
		} catch (error) {
			return state.error(null, error, cb);
		}

		if (!actorHasAccess(state.session, allowedActors)) {
			return state.error(null, 'Actor ' + state.actorId + ' not allowed access to this value. Access limited to: ' + allowedActors, cb);
		}

		clientVault.set(state.actorId, key, serialized, value.expirationTime, cb);
	});
};
