exports.ident = {
	index: ['userId'],
	vaults: {
		volatileVault: {}
	}
};

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
		client: {
			shard: function (value) {
				return value.index.userId;
			}
		},
		volatileVault: {}
	}
};

exports.testEngine = {
	index: ['username'],
	vaults: {
		volatileVault: {}
	}
};

exports.scratch = {
	index: ['key'],
	vaults: {
		client: {
			shard: function () {
				return true;
			}
		},
		volatileVault: {}
	}
};

exports.ucResponseMeta = {
	index: ['session'],
	vaults: {
		volatileVault: {}
	}
};

exports.ucResponseData = {
	index: ['session'],
	vaults: {
		volatileVault: {}
	}
};
