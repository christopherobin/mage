// based on node-mysql, this vault does not support sharding yet
//
// key format: { table: 'str', pk: { colName: 'str', colName2: 'str' } }
// serialize format: { colName: theSerializedValue, colName2: timestamp, colName3: 'mediaType' }
//
// references:
// -----------
// node-mysql:

var Archive = require('./Archive');


exports.defaultTopicApi = require('./defaultTopicApi');


// Vault wrapper around node-mysql

function MysqlVault(name, logger) {
	var that = this;

	// required exposed properties

	this.name = name;                  // the unique vault name
	this.archive = new Archive(this);  // archivist bindings

	// internals

	this.mysql = null;                 // node-mysql library
	this.config = null;                   // the URI that connections will be established to
	this.pool = null;                  // node-mysql connection pool
	this.logger = logger;

	/* jshint camelcase:false */
	// connection is here for backward compat, please use pool from now on
	this.__defineGetter__("connection", function () {
		logger.debug('Accessing the "connection" property on the mysql vault is deprecated, please' +
			' use the "pool" property');
		return that.pool;
	});
}


exports.create = function (name, logger) {
	return new MysqlVault(name, logger);
};


MysqlVault.prototype.setup = function (cfg, cb) {
	this.mysql = require('mysql');

	if (cfg.url) {
		this.config = cfg.url;
	}

	if (cfg.options) {
		if (cfg.url) {
			this.logger.warning('Both "url" and "options" are set in the config, using "options"');
		}

		this.config = cfg.options;
	}

	this.pool = this.mysql.createPool(this.config);

	process.nextTick(cb);
};

MysqlVault.prototype.close = function () {
	this.logger.verbose('Closing vault:', this.name);

	if (this.pool) {
		this.pool.end();
		this.pool = null;
	}
};


/**
 * Instantiates a fresh database based on the given configuration. The user credentials will have to
 * be set up appropriately. The collation will be set to UTF8_BIN.
 *
 * @param {Function} cb  Called upon completion.
 */

MysqlVault.prototype.createDatabase = function (cb) {
	var cfg = this.pool.config;
	if (!cfg) {
		return cb(new Error('No configuration available for vault ' + this.name));
	}

	var dbName = cfg.database;
	cfg.database = undefined;

	var sql = 'CREATE DATABASE IF NOT EXISTS ' + this.mysql.escapeId(dbName) + ' COLLATE UTF8_BIN';

	this.logger.notice(sql);

	this.pool.query(sql, null, function (error) {
		if (error) {
			return cb(error);
		}

		// restore the configured database name
		cfg.database = dbName;

		cb();
	});
};


/**
 * Destroys the database (Use with caution!)
 *
 * @param {Function} cb  Called upon completion.
 */

MysqlVault.prototype.dropDatabase = function (cb) {
	var cfg = this.pool.config;
	if (!cfg) {
		return cb(new Error('No configuration available for vault ' + this.name));
	}

	var sql = 'DROP DATABASE ' + this.mysql.escapeId(cfg.database);

	this.logger.notice(sql);

	this.pool.query(sql, null, cb);
};


/**
 * Returns a an array of all applied migration versions.
 * It also ensures the table for schema migrations exists.
 *
 * @param {Function} cb  Called upon completion, and given the array of versions.
 */

MysqlVault.prototype.getMigrations = function (cb) {
	this.logger.debug('Loading applied migrations list');

	var that = this;

	var sql =
		'CREATE TABLE IF NOT EXISTS schema_migrations (\n' +
		'  version    VARCHAR(255) NOT NULL,\n' +
		'  migratedAt INT UNSIGNED NOT NULL,\n' +
		'  report     TEXT NOT NULL,\n' +
		'  PRIMARY KEY (version)\n' +
		')\n' +
		'ENGINE=InnoDB\n' +
		'DEFAULT CHARACTER SET = utf8\n' +
		'COLLATE = utf8_bin';

	this.pool.query(sql, null, function (error) {
		if (error) {
			return cb(error);
		}

		that.select('schema_migrations', ['version'], null, null, null, function (error, rows) {
			if (error) {
				return cb(error);
			}

			rows = rows.map(function (row) {
				return row.version;
			});

			cb(null, rows);
		});
	});
};


/**
 * Stores a version in the schema migrations table. It assumes this table exists.
 *
 * @param {string}   version  The version of this migration.
 * @param {*}        report   A report that will be JSON stringified.
 * @param {Function} cb       Called upon completion.
 */

MysqlVault.prototype.registerMigration = function (version, report, cb) {
	var values = {
		version: version,
		migratedAt: parseInt(Date.now() / 1000, 10),
		report: report ? JSON.stringify(report) : ''
	};

	this.insert('schema_migrations', values, cb);
};


/**
 * Removes a version from the schema migrations table. It assumes this table exists.
 *
 * @param {string}   version  The version of this migration.
 * @param {Function} cb       Called upon completion.
 */

MysqlVault.prototype.unregisterMigration = function (version, cb) {
	var where = {
		version: version
	};

	this.del('schema_migrations', where, cb);
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

	this.pool.query(query, params, cb);
};


MysqlVault.prototype.insert = function (table, values, cb) {
	var query = 'INSERT INTO ' + this.mysql.escapeId(table) + ' SET ?';

	this.logger.verbose('Executing:', query);

	this.pool.query(query, values, cb);
};


MysqlVault.prototype.update = function (table, values, where, cb) {
	var query = 'UPDATE ' + this.mysql.escapeId(table) + ' SET ? WHERE ?';

	this.logger.verbose('Executing:', query, where);

	this.pool.query(query, [values, where], cb);
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

	this.pool.query(query, insertParams, cb);
};


MysqlVault.prototype.del = function (table, where, cb) {
	var query = 'DELETE FROM ' + this.mysql.escapeId(table) + ' WHERE ?';

	this.logger.verbose('Executing:', query, where);

	this.pool.query(query, where, cb);
};
