var fs = require('fs');
var path = require('path');
var Mocha = require('mocha');


var pathToTests = path.resolve(__dirname, '../tests/mocha-embedded');


module.exports = function (project, cb) {
	var mocha = new Mocha();

	fs.readdir(pathToTests, function (error, testFiles) {
		if (error) {
			return cb(error);
		}

		// Add unit test files to mocha object
		testFiles.sort();

		for (var testI = 0; testI < testFiles.length; testI += 1) {
			mocha.addFile(path.join(pathToTests, testFiles[testI]));
		}

		// Set mocha reporter
		mocha.reporter('spec');

		// Run active mocha unit tests
		mocha.run(cb);
	});
};