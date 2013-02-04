exports.params = ['topic', 'index', 'options'];


exports.execute = function (state, topic, index, options, cb) {
	var clientVault = state.archivist.getWriteVault('mage-client');
	if (!clientVault) {
		return state.error(null, 'No mage-client vault found.', cb);
	}

	var topicApi = state.archivist.getTopicApi(clientVault, topic);
	if (!topicApi) {
		return state.error(null, 'Unable to load topic API for topic: ' + topic, cb);
	}

	var allowedActors = topicApi.shard(topic, index);

	var actorHasAccess = (
		allowedActors === true || allowedActors === state.actorId || (Array.isArray(allowedActors) && allowedActors.indexOf(state.actorId) !== -1)
		// TODO: or if the actor is a GM
	);

	if (!actorHasAccess) {
		return state.error(null, 'Actor not allowed access to this value', cb);
	}

	state.archivist.retrieveValue(topic, index, options, function (error, value) {
		if (error) {
			return cb(error);
		}

		if (value) {
			clientVault.write(state.actorId, topicApi.key(value), topicApi.serialize(value), value.ttl, cb);
		} else {
			// no value found
			cb();
		}
	});
};

