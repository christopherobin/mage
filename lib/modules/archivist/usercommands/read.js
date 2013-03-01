exports.params = ['topic', 'index', 'options'];


exports.execute = function (state, topic, index, options, cb) {
	var clientVault = state.archivist.getWriteVault('client');
	if (!clientVault) {
		return state.error(null, 'No client vault found.', cb);
	}

	var valueHandler = state.archivist.getValueHandler(clientVault.name, topic);
	if (!valueHandler) {
		return state.error(null, 'Unable to load value handler for topic: ' + topic, cb);
	}

	state.archivist.readValue(topic, index, options, function (error, value) {
		if (error) {
			return cb(error);
		}

		if (!value || value.data === undefined) {
			return cb();
		}

		var allowedActors = valueHandler.shard(value);

		var actorHasAccess = (
			allowedActors === true || allowedActors === state.actorId || (Array.isArray(allowedActors) && allowedActors.indexOf(state.actorId) !== -1)
			// TODO: or if the actor is a GM
		);

		if (!actorHasAccess) {
			return state.error(null, 'Actor ' + state.actorId + ' not allowed access to this value. Access limited to: ' + allowedActors, cb);
		}

		clientVault.write(state.actorId, valueHandler.key(value), valueHandler.serialize(value), value.expirationTime, cb);
	});
};

