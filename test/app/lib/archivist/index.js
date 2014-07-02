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

exports.inventory = {
	index: ['userId'],
	vaults: {
		client: {
			shard: function () {
				return true;
			}
		},
		volatileVault: {}
	}
};
