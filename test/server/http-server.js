var assert = require('assert');
var fs = require('fs');
var http = require('http');
var WebSocket = require('ws');
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
	var httpServer;
	var port = 0;
	var host = '0.0.0.0';
	var url;
	var wsUrl;

	var sockPath = __dirname + '/test.sock';
	var checkTxtPath = __dirname + '/check.txt';
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
		httpServer = require('../../lib/msgServer/transports/http/index.js');
		httpServer.initialize(logger);
	});


	describe('Listening and exposing', function () {
		before(function () {
			if (fs.existsSync(sockPath)) {
				fs.unlinkSync(sockPath);
			}
		});

		after(function () {
			if (fs.existsSync(sockPath)) {
				fs.unlinkSync(sockPath);
			}
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

		it('listens on a socket file', function (done) {
			httpServer.listen(sockPath, function (error, address) {
				assert.ifError(error);
				assert.ok(address);
				assert.ok(fs.existsSync(sockPath));

				done();
			});
		});

		it('listens on a port', function (done) {
			httpServer.listen(port, host, function (error, address) {
				assert.ifError(error);
				assert.ok(address);
				assert.ok(!fs.existsSync(sockPath));

				url = 'http://' + address.address + ':' + address.port;
				wsUrl = 'ws://' + address.address + ':' + address.port;

				done();
			});
		});
	});


	describe('Routing', function () {
		var proxyEndpoint;
		var proxyEndpointUrl;
		var proxyAddress;

		function testRoute(type, requestTest, responseTest) {
			var route = '/route-test/' + type;
			httpServer.addRoute(route, requestTest, type);
			get(route + '?a=1&b=2', responseTest);
		}

		function testWsRoute(type, requestTest, responseTest) {
			var route = '/wsroute-test/' + type;
			httpServer.addRoute(route, requestTest, type);

			var ws = new WebSocket(wsUrl + route + '?a=1&b=2');
			ws.on('open', function () {
				responseTest(ws);
			});
		}


		before(function (done) {
			// create an echo server

			proxyEndpoint = http.createServer(function (req, res) {
				res.end(req.method + ' ' + req.url);
			});

			proxyEndpoint.listen(0, function () {
				var address = proxyEndpoint.address();
				proxyAddress = address;
				proxyEndpointUrl = 'http://' + address.address + ':' + address.port + '/hello/world';

				done();
			});
		});

		after(function (done) {
			proxyEndpoint.close(done);
		});

		it('runs "simple" routes', function (done) {
			function reqTest(req, res, path, query, urlInfo) {
				assert.ok(req && typeof req === 'object');
				assert.ok(res && typeof res === 'object');
				assert.ok(path && typeof path === 'string');
				assert.ok(query && typeof query === 'object');
				assert.equal(query.a, '1');
				assert.equal(query.b, '2');
				assert.ok(urlInfo && typeof urlInfo === 'object');
				res.end();
			}

			function resTest(error, result, res) {
				assert.ifError(error);
				assert.equal(res.statusCode, 200);
				done();
			}

			testRoute('simple', reqTest, resTest);
		});

		it('runs "callback" routes', function (done) {
			function reqTest(req, path, query, cb) {
				assert.ok(req && typeof req === 'object');
				assert.ok(path && typeof path === 'string');
				assert.ok(query && typeof query === 'object');
				assert.equal(query.a, '1');
				assert.equal(query.b, '2');
				assert.ok(cb && typeof cb === 'function');
				cb(200, 'Done!', { 'content-type': 'text/plain' });
			}

			function resTest(error, result, res) {
				assert.ifError(error);
				assert.equal(result, 'Done!');
				assert.equal(res.statusCode, 200);
				done();
			}

			testRoute('callback', reqTest, resTest);
		});

		it('runs "websocket" routes', function (done) {
			var received = false;

			function reqTest(client, urlInfo) {
				assert.ok(urlInfo && typeof urlInfo === 'object');

				client.on('message', function (msg) {
					assert.equal(msg, 'hello world');
					received = true;
					client.close();
				});
			}

			function resTest(ws) {
				ws.send('hello world');
				ws.on('close', function () {
					assert.equal(received, true);
					done();
				});
			}

			testWsRoute('websocket', reqTest, resTest);
		});

		it('runs "proxy" routes', function (done) {
			function reqTest(req, urlInfo) {
				assert.ok(req && typeof req === 'object');
				assert.ok(urlInfo && typeof urlInfo === 'object');

				return proxyAddress;
			}

			function resTest(error, result, res) {
				assert.ifError(error);
				assert.equal(result, 'GET /route-test/proxy?a=1&b=2');
				assert.equal(res.statusCode, 200);
				done();
			}

			testRoute('proxy', reqTest, resTest);
		});
	});


	describe('check.txt', function () {
		before(function () {
			if (fs.existsSync(checkTxtPath)) {
				fs.unlinkSync(checkTxtPath);
			}
		});

		after(function () {
			if (fs.existsSync(checkTxtPath)) {
				fs.unlinkSync(checkTxtPath);
			}
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
			fs.writeFileSync(checkTxtPath, data);

			get('/check.txt', function (error, result, res) {
				assert.ifError(error);
				assert.equal(data, result);
				assert.equal(res.statusCode, 200);
				done();
			});
		});
	});


	describe('Favicon', function () {
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
	});


	describe('CORS', function () {
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
	});


	describe('Shutdown', function () {
		it('closes', function (done) {
			httpServer.close(function () {
				get('/favicon.ico', function (error) {
					assert.ok(error);
					assert.equal(error.code, 'ECONNREFUSED');
					done();
				});
			});
		});
	});
});
