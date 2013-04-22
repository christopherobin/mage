exports.access = 'user';

exports.params = ['topic', 'index', 'options'];


exports.execute = function (state, topic, index, options, cb) {
	var clientVault = state.archivist.getWriteVault('client');
	if (!clientVault) {
		return state.error(null, 'Client vault not configured in writeOrder.', cb);
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

		if (!clientVault.readAllowedForSession(state.session, allowedActors)) {
			return state.error(null, 'Actor ' + state.actorId + ' not allowed access to this value. Access limited to: ' + allowedActors, cb);
		}

		clientVault.set(state.actorId, key, serialized, value.expirationTime);

		cb();
	});
};
