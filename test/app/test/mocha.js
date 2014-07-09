var childProcess = require('child_process');
var path = require('path');
var binPath = path.join(__dirname, '..', 'node_modules', '.bin', 'mocha');

var pathToTests = './test/mocha';

var options = {
	timeout: 10000,
	env: process.env
};

module.exports = function (address, cb) {
	options.env.MAGE_APP_ADDRESS = JSON.stringify(address);

	var childArgs = ['-R', 'spec', '--recursive', path.resolve(pathToTests)];

	console.log('executing', binPath, childArgs.join(' '));

	childProcess.execFile(binPath, childArgs, options, function (error, stdout) {
		console.log(stdout);
		cb(error);
	});
};