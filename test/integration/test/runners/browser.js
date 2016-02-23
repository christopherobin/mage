// runs PhantomJS against the running instance

var async = require('async');
var path = require('path');
var pathToHarness = path.join(__dirname, 'lib/phantom-harness.js');
var exec = require('./lib/exec.js');

var options = {
	timeout: 10000
};


function runThroughPhantom(url, cb) {
	var bin = require('phantomjs').path;
	var args = [pathToHarness, url];

	console.log('Executing browser test:', bin, args.join(' '));

	exec(bin, args, options, function (error) {
		console.log('Finished executing browser test:', bin, args.join(' '));
		cb(error);
	});
}


module.exports = function (project, cb) {
	var httpServer = project.mage.core.httpServer || project.mage.core.msgServer.getHttpServer();
	var address = httpServer.server.address();

	function runTest(appName, cb) {
		var url = 'http://' + address.address + ':' + address.port + '/app/' + appName;

		runThroughPhantom(url, cb);
	}

	async.eachSeries(project.appNames, runTest, cb);
};
