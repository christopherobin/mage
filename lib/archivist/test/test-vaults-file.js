function devNull() {}

var logger = {
    debug: devNull,
    verbose: devNull,
    alert: devNull
};

var fileVaultMod = require('../vaults/file');
var fs = require('fs');
var async = require('async');
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


exports['Can instantiate a FileVault'] = function (test) {
	test.expect(1);

	var fileVault = createVault();

	test.ok(fileVault, 'FileVault instantiation failed.');

	test.done();
};


var testFilePath1 = createPath();
var testFileData1 = createSimpleData();

exports['Can create a file through core API'] = {
	test: function (test) {
		test.expect(2);

		var fileVault = createVault();

		fileVault.add(testFilePath1, testFileData1, 0, function (error) {
			test.ifError(error, 'FileVault#add returned an error');

			test.deepEqual(testFileData1.content, fs.readFileSync(absPath(testFilePath1 + testFileData1.meta.ext)), 'Write/Read equality mismatch');

			test.done();
		});
	},
	tearDown: function (cb) {
		fs.unlinkSync(absPath(testFilePath1 + '.filevault'));
		fs.unlink(absPath(testFilePath1 + testFileData1.meta.ext), cb);
	}
};


var testFilePath2 = createPath();
var testFileData2 = createSimpleData();

exports['Cannot create a file twice through core API'] = {
	test: function (test) {
		test.expect(2);

		var fileVault = createVault();

		fileVault.add(testFilePath2, testFileData2, 0, function (error) {
			test.ifError(error, 'The first call to FileVault#add returned an error');

			fileVault.add(testFilePath2, testFileData2, 0, function (error) {
				test.ok(error, 'The second call to FileVault#add did not return an error');

				test.done();
			});
		});
	},
	tearDown: function (cb) {
		fs.unlinkSync(absPath(testFilePath2 + '.filevault'));
		fs.unlink(absPath(testFilePath2 + testFileData2.meta.ext), cb);
	}
};


var testFilePath3 = createPath();
var testFileData3 = createSimpleData();

exports['Can read a file through core API'] = {
	setUp: function (cb) {
		fs.writeFileSync(absPath(testFilePath3 + '.filevault'), JSON.stringify(testFileData3.meta));
		fs.writeFile(absPath(testFilePath3 + testFileData3.meta.ext), testFileData3.content, cb);
	},
	test: function (test) {
		test.expect(2);

		var fileVault = createVault();

		fileVault.get(testFilePath3, function (error, data) {
			test.ifError(error, 'FileVault#get returned an error');

			test.deepEqual(data.content, testFileData3.content, 'Write/Read equality mismatch');

			test.done();
		});
	},
	tearDown: function (cb) {
		fs.unlinkSync(absPath(testFilePath3 + '.filevault'));
		fs.unlink(absPath(testFilePath3 + testFileData3.meta.ext), cb);
	}
};


var testFilePath4 = createPath();
var testFileData4A = createSimpleData(1);
var testFileData4B = createSimpleData(2);

exports['Can overwrite a file through core API'] = {
	setUp: function (cb) {
		fs.writeFileSync(absPath(testFilePath4 + '.filevault'), JSON.stringify(testFileData4A.meta));
		fs.writeFile(absPath(testFilePath4 + testFileData4A.meta.ext), testFileData4A.content, cb);
	},
	test: function (test) {
		test.expect(2);

		var fileVault = createVault();

		fileVault.set(testFilePath4, testFileData4B, 0, function (error) {
			test.ifError(error, 'FileVault#set returned an error');

			var data = fs.readFileSync(absPath(testFilePath4 + testFileData4B.meta.ext));

			test.deepEqual(data, testFileData4B.content, 'Write/Read equality mismatch');

			test.done();
		});
	},
	tearDown: function (cb) {
		fs.unlinkSync(absPath(testFilePath4 + '.filevault'));
		fs.unlink(absPath(testFilePath4 + testFileData4A.meta.ext), cb);
	}
};


var testFilePath5 = createPath();
var testFileData5 = createSimpleData();

exports['Can delete a file through core API'] = {
	setUp: function (cb) {
		fs.writeFileSync(absPath(testFilePath5 + '.filevault'), JSON.stringify(testFileData5.meta));
		fs.writeFile(absPath(testFilePath5 + testFileData5.meta.ext), testFileData5.content, cb);
	},
	test: function (test) {
		test.expect(3);

		var fileVault = createVault();

		fileVault.del(testFilePath5, function (error) {
			test.ifError(error, 'FileVault#del returned an error');

			test.throws(function () {
				fs.statSync(absPath(testFilePath5 + '.filevault'));
			});

			test.throws(function () {
				fs.statSync(absPath(testFilePath5 + testFileData5.meta.ext));
			});

			test.done();
		});
	},
	tearDown: function (cb) {
		// just in case the test failed, we still want to clean up

		try {
			fs.unlinkSync(absPath(testFilePath5 + '.filevault'));
		} catch (e) {}

		fs.unlink(absPath(testFilePath5 + testFileData5.meta.ext), function () { cb(); });
	}
};


var startIndex = pathId + 1;
var testFilePaths6 = [createPath(), createPath(), createPath(), createPath()];
var testFileData6 = createSimpleData();

exports['Can list files through core API'] = {
	setUp: function (cb) {
		async.forEachSeries(
			testFilePaths6,
			function (path, callback) {
				fs.writeFileSync(absPath(path + '.filevault'), JSON.stringify(testFileData6.meta));
				fs.writeFile(absPath(path + testFileData6.meta.ext), testFileData6.content, callback);
			},
			cb
		);
	},
	test: function (test) {
		test.expect(3);

		var fileVault = createVault();

		function map(file) {
			var m = file.match(/^test-data([0-9+])$/);
			if (m) {
				return parseInt(m[1], 10);
			}
		}

		fileVault.scan(map, function (error, results) {
			test.ifError(error, 'FileVault#scan returned an error');

			test.equal(results.length, testFilePaths6.length, 'Incorrect amount of results found, found: ' + JSON.stringify(results) + ' instead of ' + testFilePaths6.length);

			var expected = [startIndex, startIndex + 1, startIndex + 2, startIndex + 3];
			results.sort();

			test.deepEqual(results, expected, 'Map did not transform correctly');

			test.done();
		});
	},
	tearDown: function (cb) {
		async.forEachSeries(
			testFilePaths6,
			function (path, callback) {
				fs.unlinkSync(absPath(path + '.filevault'));
				fs.unlink(absPath(path + testFileData6.meta.ext), callback);
			},
			cb
		);
	}
};
