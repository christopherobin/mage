// based on node-mysql, this vault does not support sharding
//
// key format: { table: 'str', pk: { colName: 'str', colName2: 'str' } }
// serialize format: { colName: theSerializedValue, colName2: ttl, colName3: timestamp, colName4: 'mediaType' }
// shard format: not allowed (falsy expected)
//
// references:
// -----------
// node-mysql:


// default topic/index/data handlers

exports.defaultTopicApis = {
	serialize: function (value) {
		// throws exceptions on failure

		return {
			value: value.setEncoding(['utf8', 'buffer']).data
		};
	},
	deserialize: function (data, value) {
		var mediaType, encoding;

		if (Buffer.isBuffer(data)) {
			mediaType = 'application/octet-stream';
			encoding = 'buffer';
		} else if (typeof data === 'string') {
			mediaType = 'application/json';
			encoding = 'utf8';
		} else {
			mediaType = 'application/json';
			encoding = 'live';
		}

		value.initWithData(mediaType, data, encoding);
	},
	key: function (value) {
		return {
			table: value.topic,
			pk: value.index
		};
	}
};


// Archivist bindings into the MysqlVault API

function Archive(vault) {
	this.vault = vault;
}


Archive.prototype.read = function (api, value, cb) {
	var key = api.key(value);

	this.vault.select(key.table, key.pk, function (error, data) {
		if (error) {
			return cb(error);
		}

		if (data !== undefined) {
			api.deserialize(data, value);
		}

		cb();
	});
};


Archive.prototype.create = function (api, value, cb) {
	var key = api.key(value);
	var values = api.serialize(value);

	this.vault.insert(key.table, values, cb);
};


Archive.prototype.update = function (api, value, cb) {
	var key = api.key(value);
	var values = api.serialize(value);

	this.vault.update(key.table, values, key.pk, cb);
};


Archive.prototype.del = function (api, value, cb) {
	var key = api.key(value);

	this.vault.del(key.table, key.pk, cb);
};


// Vault wrapper around node-mysql

function MysqlVault(name) {
	// required exposed properties

	this.name = name;                  // the unique vault name
	this.archive = new Archive(this);  // archivist bindings

	this.mysql = null;
	this.connection = null;            // node-mysql connection
}


exports.create = function (name) {
	return new MysqlVault(name);
};


MysqlVault.prototype.setup = function (cfg, cb) {
	this.mysql = require('mysql');
	this.connection = this.mysql.createConnection(cfg.uri);

	cb();
};


MysqlVault.prototype.destroy = function () {
	if (this.connection) {
		this.connection.end();
		this.connection = null;
	}
};


MysqlVault.prototype.select = function (table, where, cb) {
	var query = 'SELECT * FROM ' + this.mysql.escapeId(table) + ' WHERE ?';

	this.connection.query(query, where, cb);
};


MysqlVault.prototype.insert = function (table, values, cb) {
	var query = 'INSERT INTO ' + this.mysql.escapeId(table) + ' SET ?';

	this.connection.query(query, values, cb);
};


MysqlVault.prototype.update = function (table, values, where, cb) {
	var query = 'UPDATE ' + this.mysql.escapeId(table) + ' SET ? WHERE ?';

	this.connection.query(query, [values, where], cb);
};


MysqlVault.prototype.del = function (table, where, cb) {
	var query = 'DELETE FROM ' + this.mysql.escapeId(table) + ' WHERE ?';

	this.connection.query(query, where, cb);
};
