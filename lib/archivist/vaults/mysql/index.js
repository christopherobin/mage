var mage = require('../../../mage');


// based on node-mysql, this vault does not support sharding yet
//
// key format: { table: 'str', pk: { colName: 'str', colName2: 'str' } }
// serialize format: { colName: theSerializedValue, colName2: timestamp, colName3: 'mediaType' }
//
// references:
// -----------
// node-mysql:


// default topic/index/data handlers

var DEFAULT_COLNAMES = {
	value: 'value',
	mediaType: 'mediaType'
};


exports.defaultValueHandlers = {
	serialize: function (value) {
		// { col: val, col: val, col: val }
		// throws exceptions on failure

		var cols = {};
		cols[DEFAULT_COLNAMES.value] = value.setEncoding(['utf8', 'buffer']).data;
		cols[DEFAULT_COLNAMES.mediaType] = value.mediaType;

		return cols;
	},
	deserialize: function (row, value) {
		var data = row[DEFAULT_COLNAMES.value];
		var mediaType = row[DEFAULT_COLNAMES.mediaType];

		value.setData(mediaType, data);  // let encoding be detected by the VaultValue
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


Archive.prototype.get = function (api, value, cb) {
	var key = api.key(value);

	this.vault.select(key.table, key.pk, function (error, result) {
		if (error) {
			return cb(error);
		}

		if (result && result.length > 0) {
			api.deserialize(result[0], value);
		}

		cb();
	});
};


Archive.prototype.add = function (api, value, cb) {
	var key = api.key(value);
	var values = api.serialize(value);

	this.vault.insert(key.table, key.pk, values, cb);
};


Archive.prototype.set = function (api, value, cb) {
	var key = api.key(value);
	var values = api.serialize(value);

	this.vault.updateOrInsert(key.table, values, key.pk, cb);
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

	// internals

	this.mysql = null;                 // node-mysql library
	this.url = null;                   // the URI that connections will be established to
	this.connection = null;            // node-mysql connection
	this.logger = mage.core.logger.context('vault:' + name);

}


exports.create = function (name) {
	return new MysqlVault(name);
};


MysqlVault.prototype.setup = function (cfg, cb) {
	this.mysql = require('mysql');
	this.url = cfg.url;

	try {
		this.connect();
	} catch (error) {
		this.logger.critical('Error while setting up vault', this.name + ':', error);
		return cb(error);
	}

	cb();
};


MysqlVault.prototype.connect = function () {
	var vault = this;

	this.connection = this.mysql.createConnection(this.url);

	this.connection.once('error', function (error) {
		if (error.code === 'PROTOCOL_CONNECTION_LOST') {
			vault.logger.debug('Disconnection detected, reconnecting on next SQL statement.');

			vault.connect();
		}
	});
};


MysqlVault.prototype.destroy = function () {
	if (this.connection) {
		this.connection.end();
		this.connection = null;
	}
};


MysqlVault.prototype.select = function (table, where, cb) {
	var query = 'SELECT * FROM ' + this.mysql.escapeId(table);
	var params = [];

	if (where) {
		var whereCols = [];

		for (var key in where) {
			whereCols.push(this.mysql.escapeId(key) + ' = ?');
			params.push(where[key]);
		}

		if (whereCols.length) {
			query += ' WHERE ' + whereCols.join(' AND ');
		}
	}

	this.logger.verbose('Executing:', query, params);

	this.connection.query(query, params, cb);
};


MysqlVault.prototype.insert = function (table, values, cb) {
	var query = 'INSERT INTO ' + this.mysql.escapeId(table) + ' SET ?';

	this.logger.verbose('Executing:', query);

	this.connection.query(query, values, cb);
};


MysqlVault.prototype.update = function (table, values, where, cb) {
	var query = 'UPDATE ' + this.mysql.escapeId(table) + ' SET ? WHERE ?';

	this.logger.verbose('Executing:', query, where);

	this.connection.query(query, [values, where], cb);
};


MysqlVault.prototype.updateOrInsert = function (table, pk, values, cb) {
	// Merge the key.pk into values, because these too need to be inserted.

	var insertParams = {}, update = [], i, cols, colName, escColName;

	// Run through the PK, and add the values to the insert-list.

	cols = Object.keys(pk);

	for (i = 0; i < cols.length; i++) {
		colName = cols[i];

		insertParams[colName] = pk[colName];
	}

	// Run through the values, and add them to the insert-list.
	// Also, construct the "UPDATE" clause.

	cols = Object.keys(values);

	for (i = 0; i < cols.length; i++) {
		colName = cols[i];
		escColName = this.mysql.escapeId(colName);

		insertParams[colName] = values[colName];

		update.push(escColName + ' = VALUES(' + escColName + ')');
	}

	var query = 'INSERT INTO ' + this.mysql.escapeId(table) + ' SET ? ON DUPLICATE KEY UPDATE ' + update.join(', ');

	this.logger.verbose('Executing:', query);

	this.connection.query(query, insertParams, cb);
};


MysqlVault.prototype.del = function (table, where, cb) {
	var query = 'DELETE FROM ' + this.mysql.escapeId(table) + ' WHERE ?';

	this.logger.verbose('Executing:', query, where);

	this.connection.query(query, where, cb);
};
