var assert = require('assert');
var spawn = require('child_process').spawn;
var net = require('net');
var async = require('async');
var path = require('path');


var cwd = path.resolve(path.join(__dirname, '../integration'));


describe('Application lifecycle', function () {
	function cli(args, cb) {
		var output = '';

		var proc = spawn('node', ['.'].concat(args), { cwd: cwd });

		proc.stdout.on('data', function (data) {
			output += data;
		});

		proc.stderr.on('data', function (data) {
			output += data;
		});

		proc.on('exit', function (code) {
			if (code !== 0) {
				process.stdout.write('Server log:\n');
				process.stdout.write('====================================\n');
				process.stdout.write(output);
				process.stdout.write('\n====================================\n');
			}

			assert.strictEqual(code, 0, 'Exit code must be 0, but is ' + code);
			cb();
		});
	}

	it('can start', function (done) {
		this.timeout(10000);

		cli('start', done);
	});

	it('can restart', function (done) {
		this.timeout(10000);

		cli('restart', done);
	});

	it('can stop', function (done) {
		this.timeout(10000);

		cli('stop', done);
	});
});


function parseHttpResponse(data) {
	data = data ? data.split('\n') : [];

	var result = {
		header: {},
		body: null,
		status: 0,
		corrupt: false
	};

	var body = '';
	var part = 'header';
	var m;

	if (data[0]) {
		m = data[0].match(/^HTTP\/(\d+\.\d+) (\d+)/);
		if (m) {
			result.httpVersion = m[1];
			result.status = parseInt(m[2], 10);
		}
	}

	for (var i = 1; i < data.length; i += 1) {
		var line = data[i];

		if (part === 'header') {
			line = line.trim();

			if (line === '') {
				part = 'body';
			} else {
				m = line.match(/^(.+?): (.+)$/);
				if (m) {
					result.header[m[1].trim().toLowerCase()] = m[2].trim();
				}
			}
		} else {
			if (body) {
				body += '\n' + line;
			} else {
				body = line;
			}
		}
	}


	// process chunked body

	if (result.header['transfer-encoding'] && result.header['transfer-encoding'].toLowerCase() === 'chunked') {
		while (body) {
			m = body.match(/^\r?\n?[0-9a-f]+\r?\n/im);
			if (!m) {
				// incomplete or corrupt download
				result.corrupt = true;
				break;
			}

			var chunkSize = parseInt(m[0], 16);
			if (chunkSize === 0) {
				// successful download
				break;
			}

			// drop chunk size from body

			body = body.substr(m[0].length);

			if (body) {
				// note: chunksize is in bytes, so we technically should be using Buffer objects.
				// for the sake of this test however, we don't use multibyte characters and we should be fine.

				if (result.body) {
					result.body += body.substr(0, chunkSize);
				} else {
					result.body = body.substr(0, chunkSize);
				}

				body = body.substr(chunkSize);
			}
		}
	} else if (result.header['content-length']) {
		if (body) {
			var length = parseInt(result.header['content-length'], 10);

			result.corrupt = (Buffer.byteSize(body) !== length);
			result.body = body;
		} else {
			result.corrupt = true;
		}
	}

	return result;
}


// helper function that creates a function that makes the request

function createRequestTester(host, port, fnCounter, type, reqConnType) {
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
			// this is generally good, we listen to prevent uncaught exceptions (yay, Node.js EventEmitter)
		});

		socket.on('data', function (str) {
			data += str;
		});

		socket.on('close', function () {
			var response = parseHttpResponse(data);

			fnCounter(type, response);
		});
	};
}


describe('Shutting down', function () {
	var child, host, port;

	before(function (done) {
		this.timeout(10000);

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

		function assertDuration(type, from, to) {
			var diff = process.hrtime(shutdownStart);
			var duration = diff[0] + diff[1] / 1e9; // in seconds

			assert(duration >= from, 'Socket ' + type + ' closed too soon');
			assert(duration <= to, 'Socket ' + type + ' closed too late');
		}

		// check headers

		var testFns = {
			void: function (response) {
				assert.strictEqual(response.status, 500);
				assert.equal(response.header.connection, 'close');
				assert.strictEqual(response.body, null);
				assert.strictEqual(response.corrupt, false);
				assertDuration('void', 2, 10);
			},
			headers: function (response) {
				// no response
				assert.strictEqual(response.status, 0);
				assert.strictEqual(response.body, null);
				assert.strictEqual(response.corrupt, false);
				assertDuration('headers', 2, 10);
			},
			somedata: function (response) {
				assert.strictEqual(response.status, 200);
				assert.notEqual(response.header.connection, 'close');
				assert.strictEqual(response.body, 'Some Fragmented Data');
				assert.strictEqual(response.corrupt, true);
				assertDuration('somedata', 2, 10);
			},
			alldata: function (response) {
				assert.strictEqual(response.status, 200);
				assert.notEqual(response.header.connection, 'close');
				assert.strictEqual(response.body, 'KeepAlive');
				assert.strictEqual(response.corrupt, false);
				assertDuration('alldata', 0, 1);
			},
			close: function (response) {
				assert.strictEqual(response.status, 200);
				assert.equal(response.header.connection, 'close');
				assert.strictEqual(response.body, 'Closed');
				assert.strictEqual(response.corrupt, false);
				assert.strictEqual(shutdownStart, undefined);
			}
		};

		function count(type, response) {
			closedSockets += 1;

			testFns[type](response);
		}

		var tests = [
			createRequestTester(host, port, count, 'void', 'keep-alive'),
			createRequestTester(host, port, count, 'headers', 'keep-alive'),
			createRequestTester(host, port, count, 'somedata', 'keep-alive'),
			createRequestTester(host, port, count, 'alldata', 'keep-alive'),
			createRequestTester(host, port, count, 'close', 'close')
		];

		child.on('exit', function (code) {
			assert.strictEqual(code, 0);
			assert.strictEqual(closedSockets, tests.length);

			done();
		});

		async.series(tests, function (error) {
			assert.ifError(error);

			setTimeout(function () {
				shutdownStart = process.hrtime();
				process.kill(child.pid);
			}, 250);
		});
	});
});
