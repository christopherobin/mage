var assert = require('assert');
var fs = require('fs');
var http = require('http');
var urlParse = require('url').parse;

function devNull() {
	return devNull;
}

devNull.data = devNull;
devNull.log = devNull;

var logger = {
	verbose: devNull,
	debug: devNull,
	info: devNull,
	notice: devNull,
	warning: devNull,
	error: devNull,
	alert: devNull,
	critical: devNull
};

describe('HTTP server', function () {
	var httpServer = require('../../lib/msgServer/transports/http/index.js');
	httpServer.initialize(logger);

	var port = 0;
	var host = '0.0.0.0';
	var url;

	var filePath = __dirname + '/check.txt';
	var data = 'foo';

	function getResponseParser(cb) {
		return function (res) {
			var result = '';

			res.setEncoding('utf8');

			res.on('data', function (data) {
				result += data;
			});

			res.on('end', function () {
				cb(null, result, res);
			});

			res.on('error', function (error) {
				cb(error);
			});
		};
	}

	function req(method, path, headers, data, cb) {
		var parsed = urlParse(url + path);
		var options = {
			method: method || 'GET',
			hostname: parsed.hostname,
			port: parsed.port,
			path: parsed.path,
			headers: headers
		};

		var request = http.request(options, getResponseParser(cb)).on('error', cb);
		request.end(data || undefined);
	}

	function get(path, cb) {
		http.get(url + path, getResponseParser(cb)).on('error', cb);
	}

	before(function () {
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
		}

		httpServer.initialize(logger);
	});

	it('exposes correct URLs', function () {
		httpServer.expose();
		assert.equal(httpServer.getRouteUrl('/hello'), '/hello');

		httpServer.expose(null);
		assert.equal(httpServer.getRouteUrl('/hello'), '/hello');

		httpServer.expose('');
		assert.equal(httpServer.getRouteUrl('/hello'), '/hello');

		httpServer.expose('http://foo:123/bar/');
		assert.equal(httpServer.getRouteUrl('/hello'), 'http://foo:123/bar/hello');

		httpServer.expose({
			protocol: 'https',
			host: 'example.com',
			port: 123,
			path: '/hello/world/'
		});
		assert.equal(httpServer.getRouteUrl('/yay'), 'https://example.com:123/hello/world/yay');
	});

	it('listens on a port', function (done) {
		httpServer.listen(port, host, function (error, address) {
			assert.ifError(error);
			assert.ok(address);

			url = 'http://' + address.address + ':' + address.port;

			done();
		});
	});

	it('does not serve check.txt by default', function (done) {
		get('/check.txt', function (error, result, res) {
			assert.ifError(error);
			assert.equal(res.statusCode, 404);
			done();
		});
	});

	it('enables check.txt serving', function () {
		httpServer.enableCheckTxt(__dirname);
	});

	it('still yields a 404 without check.txt', function (done) {
		get('/check.txt', function (error, result, res) {
			assert.ifError(error);
			assert.equal(res.statusCode, 404);
			done();
		});
	});

	it('serves check.txt when it exists', function (done) {
		fs.writeFileSync(filePath, data);

		get('/check.txt', function (error, result, res) {
			assert.ifError(error);
			assert.equal(data, result);
			assert.equal(res.statusCode, 200);
			done();
		});
	});

	it('serves no favicon by default', function (done) {
		get('/favicon.ico', function (error, result, res) {
			assert.ifError(error);
			assert.equal(res.statusCode, 404);
			done();
		});
	});

	it('enables and serves a custom favicon', function (done) {
		var buff = new Buffer('hello-world');

		httpServer.setFavicon(buff);

		get('/favicon.ico', function (error, result, res) {
			assert.ifError(error);
			assert.equal(res.statusCode, 200);
			assert.equal(result, 'hello-world');
			done();
		});
	});

	it('configures CORS', function () {
		httpServer.setCorsConfig({
			origin: 'http://foo.com',
			methods: ['options', 'GET', 'PoSt'],
			credentials: true
		});
	});

	it('serves CORS options', function (done) {
		var headers = {
			'Access-Control-Request-Headers': 'x-helloworld'
		};

		req('OPTIONS', '/favicon.ico', headers, null, function (error, result, res) {
			assert.ifError(error);
			assert.equal(res.headers['access-control-allow-origin'], 'http://foo.com');
			assert.equal(res.headers['access-control-allow-methods'], 'OPTIONS, GET, POST');
			assert.equal(res.headers['access-control-allow-credentials'], 'true');
			assert.equal(res.headers['access-control-allow-headers'], 'x-helloworld');
			done();
		});
	});

	it('serves files with CORS meta data', function (done) {
		get('/favicon.ico', function (error, result, res) {
			assert.ifError(error);
			assert.equal(res.statusCode, 200);
			assert.equal(res.headers['access-control-allow-origin'], 'http://foo.com');
			assert.equal(res.headers['access-control-allow-credentials'], 'true');
			done();
		});
	});

	it('closes', function (done) {
		httpServer.close(function () {
			get('/favicon.ico', function (error) {
				assert.ok(error);
				assert.equal(error.code, 'ECONNREFUSED');
				done();
			});
		});
	});


	after(function () {
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
		}
	});
});
