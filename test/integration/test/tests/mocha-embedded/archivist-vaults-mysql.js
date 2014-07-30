var mage = require('mage');
var assert = require('assert');


function createDatabase(mysqlVault, cb) {
	mysqlVault.createDatabase(function (error) {
		assert.ifError(error, 'MySQLVault#createDatabase returned an error');
		return cb();
	});
}


function createTable(mysqlVault, tableName, indexes, valueType, cb) {
	var columns = indexes.concat([
		{ name: 'value', type: valueType + ' NOT NULL' },
		{ name: 'mediaType', type: 'VARCHAR(255) NOT NULL' }
	]);

	mysqlVault.createTable(tableName, columns, cb);
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
		var indexColumns = [{ name: 'id', type: 'VARCHAR(64) NOT NULL', pk: true }];

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
			createTable(mysqlVault, testTopic, indexColumns, 'TEXT', function (error) {
				assert.ifError(error, 'MySQLVault#createTable returned an error');
				done();
			});
		});

		it('can drop a table', function (done) {
			mysqlVault.dropTable(testTopic, function (error) {
				assert.ifError(error, 'MySQLVault#dropTable returned an error');
				done();
			});
		});

		it('can drop a database', function (done) {
			dropDatabase(mysqlVault, done);
		});

		it('can\'t create a table if it already exists', function (done) {
			createDatabase(mysqlVault, function () {
				createTable(mysqlVault, testTopic, indexColumns, 'TEXT', function (error) {
					assert.ifError(error, 'MySQLVault#createTable returned an error');
					createTable(mysqlVault, testTopic, indexColumns, 'TEXT', function (error) {
						assert(error, 'MySQLVault#createTable should\'ve returned an error');
						done();
					});
				});
			});
		});

		it('can\'t drop a table if it doesn\'t exist', function (done) {
			mysqlVault.dropTable(testTopic, function (error) {
				assert.ifError(error, 'MySQLVault#dropTable returned an error');
				mysqlVault.dropTable(testTopic, function (error) {
					assert(error, 'MySQLVault#dropTable should\'ve returned an error');
					done();
				});
			});
		});

		after(function (done) {
			dropDatabase(mysqlVault, function () {
				state.close(function () {
					mysqlVault = null;
					state = null;

					done();
				});
			});
		});
	});

	describe('Get/Set Operations', function () {
		var testTopic = 'mysqlBinaryTopic';
		var index = { id: '1' };
		var binaryBuffer = new Buffer('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBA', 'base64');
		var indexColumns = [{ name: 'id', type: 'VARCHAR(64) NOT NULL', pk: true }];

		before(function (done) {
			state = new mage.core.State();
			mysqlVault = state.archivist.getWriteVault(mysqlVaultName);

			createDatabase(mysqlVault, function () {
				createTable(mysqlVault, testTopic, indexColumns, 'BLOB', done);
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
			mysqlVault.dropTable(testTopic, function () {
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