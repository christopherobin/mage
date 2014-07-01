exports.session = {
	index: ['actorId'],
	vaults: {
		client: {
			shard: function (value) {
				return value.index.actorId;
			}
		},
		volatileVault: {}
	}
};

exports.user = {
	index: ['userId'],
	vaults: {
		volatileVault: {}
	}
};
