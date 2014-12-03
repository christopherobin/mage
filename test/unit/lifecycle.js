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

function createRequestTester(host, port, fnCounter, type, reqConnType, expConnType) {
	return function (callback) {
		var socket = net.connect({ host: host, port: port });

		var requestString =
			'GET /stallforever?test=' + type + ' HTTP/1.1\r\n' +
			'Host: ' + host + ':' + port + '\r\n' +
			'Connection: ' + reqConnType + '\r\n' +
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
			data += str.toLowerCase();
		});

		socket.on('close', function () {
			if (expConnType === 'keep-alive') {
				assert.strictEqual(data.indexOf('connection: close'), -1, type + ' connection type should not be "close"');
			} else if (expConnType === 'close') {
				assert.notEqual(data.indexOf('connection: close'), -1, type + ' connection type should be "close"');
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

			// extract host and port from the running app

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
			alldata: [0, 1],
			close: undefined
		};

		function count(name) {
			closedSockets += 1;

			var expected = durations[name];

			if (expected === undefined) {
				// must be before shutdown
				assert.strictEqual(shutdownStart, undefined);

				shutdownStart = process.hrtime();
				process.kill(child.pid);
			} else {
				var diff = process.hrtime(shutdownStart);
				var duration = diff[0] + diff[1] / 1e9; // in seconds

				assert(duration >= expected[0], 'Socket ' + name + ' closed too soon');
				assert(duration <= expected[1], 'Socket ' + name + ' closed too late');
			}
		}

		var tests = [
			createRequestTester(host, port, count, 'void', 'keep-alive', 'close'),
			createRequestTester(host, port, count, 'headers', 'keep-alive', 'keep-alive'),
			createRequestTester(host, port, count, 'somedata', 'keep-alive', 'keep-alive'),
			createRequestTester(host, port, count, 'alldata', 'keep-alive', 'keep-alive'),
			createRequestTester(host, port, count, 'close', 'close', 'close')
		];

		child.on('exit', function (code) {
			assert.strictEqual(code, 0);
			assert.strictEqual(closedSockets, Object.keys(durations).length);

			done();
		});

		async.series(tests, function (error) {
			assert.ifError(error);
		});
	});
});

