var logger = require('../../loggingService').getCreator();
var fileVaultMod = require('../vaults/file');
var fs = require('fs');


function createVault() {
	return fileVaultMod.create('myFileVault', logger);
}


exports['Can instantiate a FileVault'] = function (test) {
	test.expect(1);

	var fileVault = createVault();

	test.ok(fileVault, 'FileVault instantiation failed.');

	test.done();
};


var testFilePath1 = __dirname + '/test-data1.txt';

exports['Can create a file through core API'] = {
	test: function (test) {
		test.expect(2);

		var fileVault = createVault();

		var data = new Buffer('application/json\n{"hello":"world"}');

		fileVault.add(testFilePath1, data, function (error) {
			test.ifError(error, 'FileVault#add returned an error');

			test.deepEqual(data, fs.readFileSync(testFilePath1), 'Write/Read equality mismatch');

			test.done();
		});
	},
	tearDown: function (cb) {
		fs.unlink(testFilePath1, cb);
	}
};


var testFilePath2 = __dirname + '/test-data2.txt';

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
		fs.unlink(testFilePath2, cb);
	}
};


var testFilePath3 = __dirname + '/test-data3.txt';
var testFileBuffer3 = new Buffer('application/json\n{"hello":"world"}');

exports['Can read a file through core API'] = {
	setUp: function (cb) {
		fs.writeFile(testFilePath3, testFileBuffer3, cb);
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
		fs.unlink(testFilePath3, cb);
	}
};


var testFilePath4 = __dirname + '/test-data4.txt';
var testFileBuffer4A = new Buffer('application/json\n{"hello":"world"}');
var testFileBuffer4B = new Buffer('application/json\n{"hello":"bob"}');

exports['Can overwrite a file through core API'] = {
	setUp: function (cb) {
		fs.writeFile(testFilePath4, testFileBuffer4A, cb);
	},
	test: function (test) {
		test.expect(2);

		var fileVault = createVault();

		fileVault.set(testFilePath4, testFileBuffer4B, function (error) {
			test.ifError(error, 'FileVault#set returned an error');

			var data = fs.readFileSync(testFilePath4);

			test.deepEqual(data, testFileBuffer4B, 'Write/Read equality mismatch');

			test.done();
		});
	},
	tearDown: function (cb) {
		fs.unlink(testFilePath4, cb);
	}
};


var testFilePath5 = __dirname + '/test-data4.txt';
var testFileBuffer5 = new Buffer('application/json\n{"hello":"world"}');

exports['Can delete a file through core API'] = {
	setUp: function (cb) {
		fs.writeFile(testFilePath5, testFileBuffer5, cb);
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
		fs.unlink(testFilePath5, function () {
			cb();
		});
	}
};
