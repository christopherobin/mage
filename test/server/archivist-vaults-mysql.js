function devNull() {}

var logger = {
	debug: devNull,
	verbose: devNull,
	notice: devNull,
	alert: console.error,
	error: console.error,
	warning: console.warn
};

require('../../'); // register mage in codependency
var mysqlVaultMod = require('../../lib/archivist/vaults/mysql');
var async = require('async');
var assert = require('assert');


function createVault(cb) {
	var vault = mysqlVaultMod.create('mysqlVault', logger);
	vault.setup({
		options: {
			host: 'localhost',
			user: 'root',
			password: 'aeriscloud',
			database: 'mageTest'
		}
	}, function (error) {
		assert.ifError(error, 'MySQLVault#setup returned an error');
		return cb(vault);
	});
}


function createDatabase(mysqlVault, cb) {
	mysqlVault.createDatabase(function (error) {
		assert.ifError(error, 'MySQLVault#createDatabase returned an error');
		return cb();
	});
}


function createTable(mysqlVault, tableName, indexes, valueType, cb) {
	var indexString = '';
	for (var indexName in indexes) {
		if (indexes.hasOwnProperty(indexName)) {
			indexString += '  ' + indexName + ' ' + indexes[indexName] + ' NOT NULL,\n';
		}
	}

	var sql =
		'CREATE TABLE IF NOT EXISTS `' + tableName + '` (\n' +
		indexString +
		'  value ' + valueType + ' NOT NULL,\n' +
		'  mediaType VARCHAR(255) NOT NULL,\n' +
		'  PRIMARY KEY (' + Object.keys(indexes).join(', ') + ')\n' +
		') ENGINE=InnoDB';

	mysqlVault.pool.query(sql, null, function (error) {
		assert.ifError(error, 'MySQLVault#createTable returned an error');
		return cb();
	});
}


function dropTable(mysqlVault, tableName, cb) {
	mysqlVault.pool.query('DROP TABLE `' + tableName + '`', null, function (error) {
		assert.ifError(error, 'MySQLVault#dropTable returned an error');
		return cb();
	});
}


function dropDatabase(mysqlVault, cb) {
	mysqlVault.dropDatabase(function (error) {
		assert.ifError(error, 'MySQLVault#dropDatabase returned an error');
		return cb();
	});
}


/* BEGIN TESTS */

describe('MySQL Vault', function () {
	it('can instantiate vault', function (done) {
		createVault(function (mysqlVault) {
			assert.ok(mysqlVault, 'MySQLVault instantiation failed.');
			done();
		});
	});


	describe('Databases & tables', function () {
		var testTopic = 'testTable';

		it('can create a database', function (done) {
			createVault(function (mysqlVault) {
				createDatabase(mysqlVault, done);
			});
		});

		it('can create a table', function (done) {
			createVault(function (mysqlVault) {
				createTable(mysqlVault, testTopic, { id: 'VARCHAR(64)' }, 'TEXT', done);
			});
		});

		it('can drop a table', function (done) {
			createVault(function (mysqlVault) {
				dropTable(mysqlVault, testTopic, done);
			});
		});

		it('can drop a database', function (done) {
			createVault(function (mysqlVault) {
				dropDatabase(mysqlVault, done);
			});
		});
	});
});