// runs PhantomJS against the running instance

var async = require('async');
var childProcess = require('child_process');
var path = require('path');

var options = {
	timeout: 10000
};


function runThroughPhantom(url, cb) {
	var pathToHarness = path.join(__dirname, 'lib/phantom-harness.js');

	var bin = require('phantomjs').path;
	var args = [pathToHarness, url];

	console.log('executing', bin, args.join(' '));

	childProcess.execFile(bin, args, options, function (error, stdout) {
		console.log(stdout);
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