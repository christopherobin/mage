function devNull() {}

var logger = {
	debug: devNull,
	verbose: devNull,
	alert: devNull,
	warning: devNull
};

var fileVaultMod = require('../vaults/file');
var fs = require('fs');
var async = require('async');
var assert = require('assert');
var pathJoin = require('path').join;

var pathId = 0;
var tmpPath = '/tmp';

function createPath() {
	return 'test-data' + (++pathId);
}

function createSimpleData(str) {
	return {
		meta: {
			mediaType: 'application/json',
			expirationTime: Math.floor(Date.now() / 1000) + 10,
			ext: '.json'
		},
		content: new Buffer('{"hello":' + JSON.stringify((str || 'world') + '') + '}')
	};
}

function absPath(path) {
	return pathJoin(tmpPath, path);
}

function createVault() {
	var vault = fileVaultMod.create('myFileVault', logger);
	vault.setup({ path: tmpPath }, function () {});
	return vault;
}


/* BEGIN TESTS */

describe('archivist', function () {
	describe('Basic Instantiation', function () {
		it('should not fail', function () {
			var fileVault = createVault();

			assert.ok(fileVault, 'FileVault instantiation failed.');
		});
	});


	describe('File creation through core API', function () {
		var testFilePath;
		var testFileData;

		beforeEach(function () {
			testFilePath = createPath();
			testFileData = createSimpleData();
		});

		it('should not fail', function (done) {
			var fileVault = createVault();

			fileVault.add(testFilePath, testFileData, function (error) {
				assert.ifError(error, 'FileVault#add returned an error');

				assert.deepEqual(
					testFileData.content,
					fs.readFileSync(absPath(testFilePath + testFileData.meta.ext)),
					'Write/Read equality mismatch'
				);

				done();
			});
		});

		it('should fail if attempting to add twice', function (done) {
			var fileVault = createVault();

			fileVault.add(testFilePath, testFileData, function (error) {
				assert.ifError(error, 'The first call to FileVault#add returned an error');

				fileVault.add(testFilePath, testFileData, function (error) {
					assert.ok(error, 'The second call to FileVault#add did not return an error');

					done();
				});
			});
		});

		afterEach(function () {
			fs.unlinkSync(absPath(testFilePath + '.filevault'));
			fs.unlinkSync(absPath(testFilePath + testFileData.meta.ext));
		});
	});


	describe('File reading through core API', function () {
		var testFilePath = createPath();
		var testFileData = createSimpleData();

		before(function () {
			fs.writeFileSync(absPath(testFilePath + '.filevault'), JSON.stringify(testFileData.meta));
			fs.writeFileSync(absPath(testFilePath + testFileData.meta.ext), testFileData.content);
		});

		it('should not fail', function (done) {
			var fileVault = createVault();

			fileVault.get(testFilePath, function (error, data) {
				assert.ifError(error, 'FileVault#get returned an error');

				assert.deepEqual(data.content, testFileData.content, 'Write/Read equality mismatch');
				done();
			});
		});

		after(function () {
			fs.unlinkSync(absPath(testFilePath + '.filevault'));
			fs.unlinkSync(absPath(testFilePath + testFileData.meta.ext));
		});
	});


	describe('File overwriting through core API', function () {
		var testFilePath = createPath();
		var testFileDataA = createSimpleData(1);
		var testFileDataB = createSimpleData(2);

		before(function () {
			fs.writeFileSync(absPath(testFilePath + '.filevault'), JSON.stringify(testFileDataA.meta));
			fs.writeFileSync(absPath(testFilePath + testFileDataA.meta.ext), testFileDataA.content);
		});

		it('should not fail', function (done) {
			var fileVault = createVault();

			fileVault.set(testFilePath, testFileDataB, function (error) {
				assert.ifError(error, 'FileVault#set returned an error');

				var data = fs.readFileSync(absPath(testFilePath + testFileDataB.meta.ext));

				assert.deepEqual(data, testFileDataB.content, 'Write/Read equality mismatch');
				done();
			});
		});

		after(function () {
			fs.unlinkSync(absPath(testFilePath + '.filevault'));
			fs.unlinkSync(absPath(testFilePath + testFileDataA.meta.ext));
		});
	});


	describe('File deletion through core API', function () {
		var testFilePath = createPath();
		var testFileData = createSimpleData();

		before(function () {
			fs.writeFileSync(absPath(testFilePath + '.filevault'), JSON.stringify(testFileData.meta));
			fs.writeFileSync(absPath(testFilePath + testFileData.meta.ext), testFileData.content);
		});

		it('should not fail', function (done) {
			var fileVault = createVault();

			fileVault.del(testFilePath, function (error) {
				assert.ifError(error, 'FileVault#del returned an error');

				assert.throws(function () {
					fs.statSync(absPath(testFilePath + '.filevault'));
				});

				assert.throws(function () {
					fs.statSync(absPath(testFilePath + testFileData.meta.ext));
				});

				done();
			});
		});

		after(function () {
			// just in case the test failed, we still want to clean up

			try {
				fs.unlinkSync(absPath(testFilePath + '.filevault'));
			} catch (e) {}

			try {
				fs.unlinkSync(absPath(testFilePath + testFileData.meta.ext));
			} catch (e) {}
		});
	});


	describe('Extension change', function () {
		var testFilePath = createPath();
		var testFileData = createSimpleData();

		before(function () {
			fs.writeFileSync(absPath(testFilePath + '.filevault'), JSON.stringify(testFileData.meta));
			fs.writeFileSync(absPath(testFilePath + testFileData.meta.ext), testFileData.content);
		});

		it('delete the file with the old extension', function (done) {
			var fileVault = createVault();

			var oldExtension = testFileData.meta.ext;
			testFileData.meta.ext = '.banana';

			fileVault.set(testFilePath, testFileData, function (error) {
				assert.ifError(error, 'FileVault#set returned an error');

				assert(fs.statSync(absPath(testFilePath + '.filevault')));
				assert(fs.statSync(absPath(testFilePath + testFileData.meta.ext)));

				assert.throws(function () {
					fs.statSync(absPath(testFilePath + oldExtension));
				});

				done();
			});
		});

		after(function () {
			// just in case the test failed, we still want to clean up

			try {
				fs.unlinkSync(absPath(testFilePath + '.filevault'));
			} catch (e) {}

			try {
				fs.unlinkSync(absPath(testFilePath + testFileData.meta.ext));
			} catch (e) {}
		});
	});


	describe('Listing files through core API', function () {
		var startIndex = pathId + 1;
		var testFilePaths = [createPath(), createPath(), createPath(), createPath()];
		var testFileData = createSimpleData();

		before(function (done) {
			function writeVault(path, callback) {
				fs.writeFile(absPath(path + '.filevault'), JSON.stringify(testFileData.meta), function (error) {
					if (error) {
						return callback(error);
					}

					fs.writeFile(absPath(path + testFileData.meta.ext), testFileData.content, callback);
				});
			}

			async.forEachSeries(testFilePaths, writeVault, done);
		});

		it('should not fail', function (done) {
			var fileVault = createVault();

			function map(file) {
				var m = file.match(/^test-data([0-9+])$/);
				if (m) {
					return parseInt(m[1], 10);
				}
			}

			fileVault.scan(map, function (error, results) {
				assert.ifError(error, 'FileVault#scan returned an error');

				assert.strictEqual(
					results.length,
					testFilePaths.length,
					'Incorrect amount of results found, found: ' + JSON.stringify(results) + ' instead of ' + testFilePaths.length
				);

				var expected = [startIndex, startIndex + 1, startIndex + 2, startIndex + 3];
				results.sort();

				assert.deepEqual(results, expected, 'Map did not transform correctly');

				done();
			});
		});

		after(function (done) {
			function removeVault(path, callback) {
				fs.unlink(absPath(path + '.filevault'), function (error) {
					if (error) {
						return callback(error);
					}

					fs.unlink(absPath(path + testFileData.meta.ext), callback);
				});
			}

			async.forEachSeries(testFilePaths, removeVault, done);
		});
	});

	describe('Expiring files', function () {
		var testFilePath = createPath();
		var testFileData = createSimpleData();

		before(function () {
			testFileData.meta.expirationTime -= 100;
			fs.writeFileSync(absPath(testFilePath + '.filevault'), JSON.stringify(testFileData.meta));
			fs.writeFileSync(absPath(testFilePath + testFileData.meta.ext), testFileData.content);
		});

		it('Reading a file that expired does not return data', function (done) {
			var fileVault = createVault();

			fileVault.get(testFilePath, function (error, data) {
				assert.equal(error, undefined, 'FileVault#get returned an error');
				assert.equal(data, undefined, 'FileVault returned data.');

				done();
			});
		});

		after(function () {
			try {
				fs.unlinkSync(absPath(testFilePath + '.filevault'));
				fs.unlinkSync(absPath(testFilePath + testFileData.meta.ext));
			} catch (e) {

			}
		});
	});
});
