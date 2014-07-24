var mage = require('mage');
var assert = require('assert');


function createDatabase(mysqlVault, cb) {
	mysqlVault.createDatabase(function (error) {
		assert.ifError(error, 'MySQLVault#createDatabase returned an error');
		return cb();
	});
}


function createTable(mysqlVault, tableName, indexes, valueType, cb) {
	mysqlVault.createTable(tableName, indexes, valueType, function (error) {
		assert.ifError(error, 'MySQLVault#createTable returned an error');
		return cb();
	});
}


function dropTable(mysqlVault, tableName, cb) {
	mysqlVault.dropTable(tableName, function (error) {
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
	var state = null;
	var mysqlVault = null;
	var mysqlVaultName = 'mysqlVault';

	describe('Databases & tables', function () {
		var testTopic = 'testTable';

		before(function (done) {
			state = new mage.core.State();
			mysqlVault = state.archivist.getWriteVault(mysqlVaultName);

			// Drop database before starting
			dropDatabase(mysqlVault, done);
		});

		it('can create a database', function (done) {
			createDatabase(mysqlVault, done);
		});

		it('can create a table', function (done) {
			createTable(mysqlVault, testTopic, [{ name: 'id', type: 'VARCHAR(64) NOT NULL' }], 'TEXT', done);
		});

		it('can drop a table', function (done) {
			dropTable(mysqlVault, testTopic, done);
		});

		it('can drop a database', function (done) {
			dropDatabase(mysqlVault, done);
		});

		after(function (done) {
			state.close(function () {
				mysqlVault = null;
				state = null;

				done();
			});
		});
	});

	describe('Get/Set Operations', function () {
		var testTopic = 'mysqlBinaryTopic';
		var index = { id: '1' };
		var binaryBuffer = new Buffer('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBA', 'base64');

		before(function (done) {
			state = new mage.core.State();
			mysqlVault = state.archivist.getWriteVault(mysqlVaultName);

			createDatabase(mysqlVault, function () {
				createTable(mysqlVault, testTopic, [{ name: 'id', type: 'VARCHAR(64) NOT NULL' }], 'BLOB', done);
			});
		});

		it('can successfully write binary data', function (done) {
			state.archivist.set(testTopic, index, binaryBuffer, 'application/octet-stream', 'live');
			state.archivist.distribute(function (error) {
				assert.ifError(error, 'MySQLVault#distribute returned an error');
				state.archivist.get(testTopic, index, null, function (error, getData) {
					assert.ifError(error, 'MySQLVault#get returned an error');
					assert.deepEqual(getData, binaryBuffer, 'Write/Read equality mismatch');
					done();
				});
			});
		});

		after(function (done) {
			dropTable(mysqlVault, testTopic, function () {
				dropDatabase(mysqlVault, function () {
					state.close(function () {
						mysqlVault = null;
						state = null;

						done();
					});
				});
			});
		});
	});
});