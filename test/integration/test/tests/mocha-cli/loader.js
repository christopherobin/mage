// Most of the loader API is tested through unit tests.
// Some extra bits are tested here.

var assert = require('assert');
var http = require('http');

describe('Loader', function () {
	var address = JSON.parse(process.env.MAGE_APP_ADDRESS);

	function get(path, headers, cb) {
		var options = {};
		options.method = 'GET';
		options.hostname = address.address;
		options.port = address.port;
		options.path = path;
		options.headers = headers;

		var req = http.request(options, function (res) {
			res.setEncoding('utf8');

			var data = '';

			res.on('data', function (str) {
				data += str;
			});

			res.on('end', function () {
				cb(res.statusCode, res.headers, data);
			});
		});

		req.end();
	}

	it('should serve last-modified headers', function (done) {
		get('/app/test', {}, function (code, headers) {
			assert.equal(code, 200);
			assert(headers['last-modified']);

			var d = new Date(headers['last-modified']);
			var secondsAgo = (Date.now() - d.getTime()) / 1000;
			assert(secondsAgo < 5 * 60); // give it 5 mins
			done();
		});
	});

	it('should not serve cached pages', function (done) {
		var future = new Date();
		future.setFullYear(future.getFullYear() + 1);

		var headers = {
			'if-modified-since': future.toUTCString()
		};

		get('/app/test', headers, function (code, headers) {
			assert.equal(code, 304);
			assert(headers['last-modified']);

			var ts = (new Date(headers['last-modified'])).getTime();
			assert(!isNaN(ts));

			done();
		});
	});
});

