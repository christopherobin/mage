/**
 * This is your Archivist topic/index configuration
 * For more information, please read the Archivist documentation.
 */

exports.ucResponseMeta = {
	index: ['session'],
	vaults: {
		// Please add one or more vault references here (they must support key expiration)
		memory: {}
	}
};

exports.ucResponseData = {
	index: ['session'],
	vaults: {
		// Please add one or more vault references here (they must support key expiration)
		memory: {}
	}
};

exports.session = {
	index: ['actorId'],
	vaults: {
		// Please add one or more vault references here (they must support key expiration)
		memory: {},
		client: {
			shard: function (value) {
				return value.index.actorId;
			}
		}
	}
};
