var childProcess = require('child_process');
var path = require('path');
var binPath = path.join(__dirname, '../../node_modules/.bin/mocha');

var pathToTests = path.join(__dirname, '../tests/mocha-cli');

var options = {
	timeout: 10000,
	env: process.env
};

module.exports = function (project, cb) {
	var httpServer = project.mage.core.httpServer || project.mage.core.msgServer.getHttpServer();
	var address = httpServer.server.address();

	options.env.MAGE_APP_ADDRESS = JSON.stringify(address);

	var childArgs = ['-R', 'spec', '--recursive', pathToTests];

	console.log('executing', binPath, childArgs.join(' '));

	childProcess.execFile(binPath, childArgs, options, function (error, stdout) {
		console.log(stdout);
		cb(error);
	});
};