/**
 * This is your Archivist topic/index configuration.
 * For more information, please read the Archivist documentation.
 */

exports.ucResponseMeta = {
	index: ['session'],
	vaults: {
		// Please add one or more vault references here (they must support key expiration)
		volatileVault: {}
	}
};

exports.ucResponseData = {
	index: ['session'],
	vaults: {
		// Please add one or more vault references here (they must support key expiration)
		volatileVault: {}
	}
};

exports.session = {
	index: ['actorId'],
	vaults: {
		// Please add one or more vault references here (they must support key expiration)
		volatileVault: {},
		client: {
			shard: function (value) {
				return value.index.actorId;
			}
		}
	}
};

exports.ident = {
	index: ['userId'],
	vaults: {
		userVault: {}
	}
};
