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

exports.userCreds = {
	index: ['userId'],
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


exports.mysqlBinaryTopic = {
	index: ['id'],
	readOptions: {
		mediaTypes: ['application/octet-stream'],
		encodings: ['live'],
		optional: false
	},
	vaults: {
		mysqlVault: {}
	}
};