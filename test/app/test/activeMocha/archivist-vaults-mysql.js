var mage = require('mage');
var assert = require('assert');


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
	var state, mysqlVault;

	var mysqlVaultName = 'mysqlVault';
	var testTopic = 'mysqlBinaryTopic';

	var index = { id: '1' };
	var binaryBuffer = new Buffer('sdfsdgdsfgsdfgsdg');

	before(function (done) {
		state = new mage.core.State();
		mysqlVault = state.archivist.getWriteVault(mysqlVaultName);

		createDatabase(mysqlVault, function () {
			createTable(mysqlVault, testTopic, { id: 'VARCHAR(64)' }, 'TEXT', done);
		});
	});

	it('can successfully write binary data', function (done) {
		state.archivist.set(testTopic, index, binaryBuffer, 'application/octet-stream', 'live');
		state.archivist.distribute(function (error) {
			assert.ifError(error, 'MySQLVault#distribute returned an error');
			state.archivist.get(testTopic, index, {}, function (error, getData) {
				assert.ifError(error, 'MySQLVault#get returned an error');
				assert.deepEqual(getData, binaryBuffer, 'Write/Read equality mismatch');
				done();
			});
		});
	});

	after(function (done) {
		dropTable(mysqlVault, testTopic, function () {
			dropDatabase(mysqlVault, function () {
				state.close(done);
			});
		});
	});
});