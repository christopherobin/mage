// based on node-mysql, this vault does not support sharding yet
//
// key format: { table: 'str', pk: { colName: 'str', colName2: 'str' } }
// serialize format: { colName: theSerializedValue, colName2: timestamp, colName3: 'mediaType' }
//
// references:
// -----------
// node-mysql:

var Archive = require('./Archive');


exports.defaultValueHandlers = require('./defaultValueHandlers');


// Vault wrapper around node-mysql

function MysqlVault(name, logger) {
	// required exposed properties

	this.name = name;                  // the unique vault name
	this.archive = new Archive(this);  // archivist bindings

	// internals

	this.mysql = null;                 // node-mysql library
	this.url = null;                   // the URI that connections will be established to
	this.connection = null;            // node-mysql connection
	this.logger = logger;

}


exports.create = function (name, logger) {
	return new MysqlVault(name, logger);
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

	this.connection.on('error', function (error) {
		if (error.code === 'PROTOCOL_CONNECTION_LOST') {
			vault.logger.debug('Disconnection detected, reconnecting on next SQL statement.');

			vault.connect();
		}
	});
};


MysqlVault.prototype.close = function () {
	this.logger.verbose('Closing vault:', this.name);

	if (this.connection) {
		this.connection.end();
		this.connection = null;
	}
};


MysqlVault.prototype.select = function (table, cols, where, order, limit, cb) {
	var columns, i, len;

	if (Array.isArray(cols)) {
		len = cols.length;
		if (len === 0) {
			return cb(new Error('MySQL cannot select 0 columns.'));
		}

		columns = new Array(len);

		for (i = 0; i < len; i++) {
			columns[i] = this.mysql.escapeId(cols[i]);
		}

		columns = columns.join(', ');
	}

	var query = 'SELECT ' + (columns || '*') + ' FROM ' + this.mysql.escapeId(table);
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

	if (order && order.length > 0) {
		// format: [{ name: 'colName', direction: 'asc' }, { name: 'colName2', direction: 'desc' }]
		// direction is 'asc' by default

		query += ' ORDER BY ';

		for (i = 0; i < order.length; i++) {
			if (i > 0) {
				query += ', ';
			}

			query += this.mysql.escapeId(order[i].name) + ' ' + (order[i].direction === 'desc' ? 'DESC' : 'ASC');
		}
	}

	if (limit) {
		query += ' LIMIT ' + parseInt(limit[0], 10);

		if (limit.length === 2) {
			query += ', ' + parseInt(limit[1], 10);
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
