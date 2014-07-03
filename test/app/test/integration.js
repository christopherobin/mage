var async = require('async');
var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');
var phantomjs = require('phantomjs');
var binPath = phantomjs.path;

var pathToTests = './test/integration';

var options = {
	timeout: 10000
};

module.exports = function (address, cb) {
	function runTest(filename, cb) {
		var childArgs = [path.resolve(path.join(pathToTests, filename)), 'http://' + address.address + ':' + address.port];

		console.log('executing', binPath, childArgs[0], childArgs[1]);

		childProcess.execFile(binPath, childArgs, options, function (error, stdout) {
			console.log(stdout);
			cb(error);
		});
	}

	fs.readdir(pathToTests, function (error, integrationTests) {
		if (error) {
			return cb(error);
		}

		async.eachSeries(integrationTests, runTest, cb);
	});
};