exports.params = ['topic', 'vars', 'options'];


exports.execute = function (state, topic, vars, options, cb) {
	var clientVault = state.archivist.getWriteVault('mage-client');
	if (!clientVault) {
		return state.error(null, 'No mage-client vault found.', cb);
	}

	var topicApi = state.archivist.getTopicApi(clientVault, topic);
	if (!topicApi) {
		return state.error(null, 'Unable to load topic API for topic: ' + topic, cb);
	}

	var shard = topicApi.shard(topic, vars);
	var key = topicApi.key(topic, vars);

	var actorHasAccess = (
		shard === true || shard === state.actorId || (Array.isArray(shard) && shard.indexOf(state.actorId) !== -1)
		// TODO: or if the actor is a GM
	);

	if (!actorHasAccess) {
		return state.error(null, 'Actor not allowed access to this value', cb);
	}

	state.archivist.retrieveJacket(topic, vars, options, function (error, jacket) {
		if (error) {
			return cb(error);
		}

		var ttl, value;

		if (jacket && jacket.value) {
			ttl = jacket.ttl;
			value = jacket.value;
		}

		clientVault.emitEvent(state.actorId, 'create', key, ttl, value, cb);
	});
};

