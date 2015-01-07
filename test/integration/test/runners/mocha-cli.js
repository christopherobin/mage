var path = require('path');
var bin = path.join(__dirname, '../../node_modules/.bin/mocha');
var exec = require('./lib/exec.js');

var pathToTests = path.join(__dirname, '../tests/mocha-cli');

var options = {
	timeout: 30000,
	env: process.env
};

module.exports = function (project, cb) {
	var httpServer = project.mage.core.httpServer || project.mage.core.msgServer.getHttpServer();
	var address = httpServer.server.address();

	options.env.MAGE_APP_ADDRESS = JSON.stringify(address);

	var args = ['-R', 'spec', '--recursive', pathToTests];

	console.log('Executing mocha-cli test:', bin, args.join(' '));

	exec(bin, args, options, function (error) {
		console.log('Finished executing mocha-cli test:', bin, args.join(' '));
		cb(error);
	});
};