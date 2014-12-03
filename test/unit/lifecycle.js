var assert = require('assert');
var spawn = require('child_process').spawn;
var net = require('net');
var async = require('async');
var path = require('path');


var cwd = path.resolve(path.join(__dirname, '../integration'));


describe('Application lifecycle', function () {
	function cli(args, cb) {
		var proc = spawn('node', ['.'].concat(args), { cwd: cwd });
		proc.on('exit', function (code) {
			assert.strictEqual(code, 0);
			cb();
		});
	}


	it('can start', function (done) {
		this.timeout(5000);

		cli('start', done);
	});

	it('can restart', function (done) {
		this.timeout(10000);

		cli('restart', done);
	});

	it('can stop', function (done) {
		this.timeout(5000);

		cli('stop', done);
	});
});


// helper function that creates a function that makes the request

function createRequestTester(host, port, fnCounter, type, expectGracefulHeader) {
	return function (callback) {
		var socket = net.connect({ host: host, port: port });

		var requestString =
			'GET /stallforever?test=' + type + ' HTTP/1.1\r\n' +
			'Host: ' + host + ':' + port + '\r\n' +
			'\r\n';

		var data = '';

		socket.on('connect', function () {
			socket.write(requestString, callback);
		});

		socket.setEncoding('utf8');

		socket.on('error', function (error) {
			// this is generally good
		});

		socket.on('data', function (str) {
			data += str;
		});

		socket.on('close', function () {
			if (expectGracefulHeader) {
				assert.notEqual(data.toLowerCase().indexOf('connection: close'), -1, 'Connection: close header missing');
			}

			fnCounter(type);
		});
	};
}


describe('Shutting down', function () {
	var child, host, port;

	before(function (done) {
		child = spawn('node', ['.', '-v'], { cwd: cwd });

		child.stderr.setEncoding('utf8');

		child.stderr.on('data', function (data) {
			// look for [MAGE httpServer] Server running at http://0.0.0.0:8080

			if (data.indexOf('httpServer') === -1) {
				return;
			}

			var m = data.match(/server running at http:\/\/(.+)?:(\d+)/i);
			if (!m) {
				return;
			}

			// extract host and port from the running app and create the connections

			host = m[1];
			port = parseInt(m[2]);

			done();
		});
	});

	it('can stop with pending connections', function (done) {
		this.timeout(10000);

		var shutdownStart;
		var closedSockets = 0;

		var durations = {
			void: [2, 10],
			headers: [2, 10],
			somedata: [2, 10],
			alldata: [0, 1]
		};

		function count(name) {
			closedSockets += 1;

			var diff = process.hrtime(shutdownStart);
			var duration = diff[0] + diff[1] / 1e9; // in seconds
			var expected = durations[name];

			assert(duration >= expected[0], 'Socket ' + name + ' closed too soon');
			assert(duration <= expected[1], 'Socket ' + name + ' closed too late');
		}

		var tests = [
			createRequestTester(host, port, count, 'void', true),
			createRequestTester(host, port, count, 'headers'),
			createRequestTester(host, port, count, 'somedata'),
			createRequestTester(host, port, count, 'alldata')
		];

		child.on('exit', function (code) {
			assert.strictEqual(code, 0);
			assert.strictEqual(closedSockets, Object.keys(durations).length);

			done();
		});

		async.parallel(tests, function (error) {
			assert.ifError(error);

			// allow the server a bit of time to process the incoming requests, then send a kill signal to shut down
			// the application

			setTimeout(function () {
				shutdownStart = process.hrtime();
				process.kill(child.pid);
			}, 250);

			// from here, the child's on('exit') will take over
		});
	});
});

