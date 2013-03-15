var logger = require('../../loggingService').getCreator();
var fileVaultMod = require('../vaults/file');
var fs = require('fs');
var async = require('async');
var pathJoin = require('path').join;


var pathId = 0;
var tmpPath = '/tmp';

function createPath() {
	return 'test-data' + (++pathId) + '.txt';
}

function absPath(path) {
	return pathJoin(tmpPath, path);
}

function createVault() {
	var vault = fileVaultMod.create('myFileVault', logger);
	vault.setup({ path: tmpPath }, function () {});
	return vault;
}


exports['Can instantiate a FileVault'] = function (test) {
	test.expect(1);

	var fileVault = createVault();

	test.ok(fileVault, 'FileVault instantiation failed.');

	test.done();
};


var testFilePath1 = createPath();

exports['Can create a file through core API'] = {
	test: function (test) {
		test.expect(2);

		var fileVault = createVault();

		var data = new Buffer('application/json\n{"hello":"world"}');

		fileVault.add(testFilePath1, data, function (error) {
			test.ifError(error, 'FileVault#add returned an error');

			test.deepEqual(data, fs.readFileSync(absPath(testFilePath1)), 'Write/Read equality mismatch');

			test.done();
		});
	},
	tearDown: function (cb) {
		fs.unlink(absPath(testFilePath1), cb);
	}
};


var testFilePath2 = createPath();

exports['Cannot create a file twice through core API'] = {
	test: function (test) {
		test.expect(2);

		var fileVault = createVault();

		var data = new Buffer('application/json\n{"hello":"world"}');

		fileVault.add(testFilePath2, data, function (error) {
			test.ifError(error, 'The first call to FileVault#add returned an error');

			fileVault.add(testFilePath2, data, function (error) {
				test.ok(error, 'The second call to FileVault#add did not return an error');

				test.done();
			});
		});
	},
	tearDown: function (cb) {
		fs.unlink(absPath(testFilePath2), cb);
	}
};


var testFilePath3 = createPath();
var testFileBuffer3 = new Buffer('application/json\n{"hello":"world"}');

exports['Can read a file through core API'] = {
	setUp: function (cb) {
		fs.writeFile(absPath(testFilePath3), testFileBuffer3, cb);
	},
	test: function (test) {
		test.expect(2);

		var fileVault = createVault();

		fileVault.get(testFilePath3, function (error, data) {
			test.ifError(error, 'FileVault#get returned an error');

			test.deepEqual(data, testFileBuffer3, 'Write/Read equality mismatch');

			test.done();
		});
	},
	tearDown: function (cb) {
		fs.unlink(absPath(testFilePath3), cb);
	}
};


var testFilePath4 = createPath();
var testFileBuffer4A = new Buffer('application/json\n{"hello":"world"}');
var testFileBuffer4B = new Buffer('application/json\n{"hello":"bob"}');

exports['Can overwrite a file through core API'] = {
	setUp: function (cb) {
		fs.writeFile(absPath(testFilePath4), testFileBuffer4A, cb);
	},
	test: function (test) {
		test.expect(2);

		var fileVault = createVault();

		fileVault.set(testFilePath4, testFileBuffer4B, function (error) {
			test.ifError(error, 'FileVault#set returned an error');

			var data = fs.readFileSync(absPath(testFilePath4));

			test.deepEqual(data, testFileBuffer4B, 'Write/Read equality mismatch');

			test.done();
		});
	},
	tearDown: function (cb) {
		fs.unlink(absPath(testFilePath4), cb);
	}
};


var testFilePath5 = createPath();
var testFileBuffer5 = new Buffer('application/json\n{"hello":"world"}');

exports['Can delete a file through core API'] = {
	setUp: function (cb) {
		fs.writeFile(absPath(testFilePath5), testFileBuffer5, cb);
	},
	test: function (test) {
		test.expect(2);

		var fileVault = createVault();

		fileVault.del(testFilePath5, function (error) {
			test.ifError(error, 'FileVault#del returned an error');

			test.throws(function () {
				fs.statSync(testFilePath5);
			});

			test.done();
		});
	},
	tearDown: function (cb) {
		// just in case the test failed, we still want to clean up
		fs.unlink(absPath(testFilePath5), function () {
			cb();
		});
	}
};


var startIndex = pathId + 1;
var testFilePaths6 = [createPath(), createPath(), createPath(), createPath()];
var testFileBuffer6 = new Buffer('application/json\n{"hello":"world"}');

exports['Can list files through core API'] = {
	setUp: function (cb) {
		async.forEachSeries(
			testFilePaths6,
			function (path, callback) {
				fs.writeFile(absPath(path), testFileBuffer6, callback);
			},
			cb
		);
	},
	test: function (test) {
		test.expect(3);

		var fileVault = createVault();

		function map(file) {
			var m = file.match(/^test-data([0-9+])\.txt$/);
			if (m) {
				return parseInt(m[1], 10);
			}
		}

		fileVault.scan(map, function (error, results) {
			test.ifError(error, 'FileVault#scan returned an error');

			test.equal(results.length, testFilePaths6.length, 'Incorrect amount of results found');

			var expected = [startIndex, startIndex + 1, startIndex + 2, startIndex + 3];
			results.sort();

			test.deepEqual(results, expected, 'Map did not transform correctly');
		});

		test.done();
	},
	tearDown: function (cb) {
		async.forEachSeries(
			testFilePaths6,
			function (path, callback) {
				fs.unlink(absPath(path), callback);
			},
			cb
		);
	}
};
