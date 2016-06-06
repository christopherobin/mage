exports.ident = {
	index: ['userId'],
	vaults: {
		client: {
			shard: function (value) {
				return value.index.userId;
			},
			acl: function (test) {
				test('user', '*', { shard: true });
				test('admin', '*');
			}
		},
		volatileVault: {}
	}
};

exports.mageUsernames = {
	index: ['username'],
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

exports.mysqlDelTopic = {
	index: ['id', 'name'],
	readOptions: {
		mediaTypes: ['application/octet-stream'],
		encodings: ['live'],
		optional: false
	},
	vaults: {
		mysqlVault: {}
	}
};

exports.shardTest = {
	index: ['userId'],
	vaults: {
		client: {
			shard: function (value) {
				return value.data;
			},
			acl: function (test) {
				test('user', '*', { shard: true });
				test('admin', '*');
			}
		},
		volatileVault: {}
	}
};

exports.session = {
	index: ['actorId'],
	vaults: {
		client: {
			shard: function (value) {
				return value.index.actorId;
			},
			acl: function (test) {
				test('user', 'get', { shard: true });
				test('admin', '*');
			}
		},
		volatileVault: {}
	}
};

exports.scratch = {
	index: ['key'],
	vaults: {
		client: {
			shard: function () {
				return true;
			},
			acl: function (test) {
				test('admin', '*');
			}
		},
		volatileVault: {}
	}
};

exports.ucResponseData = {
	index: ['session'],
	vaults: {
		volatileVault: {}
	}
};

exports.ucResponseMeta = exports.ucResponseData;

exports.user = {
	index: ['userId'],
	vaults: {
		client: {
			shard: function (value) {
				return value.index.userId;
			},
			acl: function (test) {
				test('user', '*', { shard: true });
				test('admin', '*');
			}
		},
		volatileVault: {}
	}
};
