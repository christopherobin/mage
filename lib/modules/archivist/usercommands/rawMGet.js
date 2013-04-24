exports.access = 'user';

exports.params = ['queries', 'options'];


exports.execute = function (state, queries, options, cb) {
	var clientVault = state.archivist.getWriteVault('client');
	if (!clientVault) {
		return state.error(null, 'No client vault found.', cb);
	}

	// We don't care about how the queries are indexed (array, or object), so we unify them first
	// into an array. That way we can process the result as an array too.

	var realQueries = queries;

	if (!Array.isArray(queries)) {
		realQueries = [];

		for (var queryId in queries) {
			realQueries.push(queries[queryId]);
		}
	}

	state.archivist.mgetValues(realQueries, options, function (error, values) {
		if (error) {
			return cb(error);
		}

		for (var i = 0; i < values.length; i++) {
			var value = values[i];

			if (!value || value.data === undefined) {
				continue;
			}

			var allowedActors, key, serialized;

			var valueHandler = state.archivist.getValueHandler(clientVault.name, value.topic);
			if (!valueHandler) {
				return state.error(null, 'Unable to load value handler on client vault for topic: ' + value.topic, cb);
			}

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
		}

		cb();
	});
};