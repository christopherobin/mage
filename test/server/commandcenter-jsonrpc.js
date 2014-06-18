require('../..');

var assert = require('assert');
var child = require('child_process');
var path = require('path');

var async = require('async');
var jayson = require('jayson');

var sandbox = path.join(
	__dirname,
	'..',
	'..',
	'sandbox'
);

// Remove the listeners added by MAGE
// Mocha should handle all the exceptions
process.removeAllListeners('uncaughtException');

describe('commandCenter', function () {
	describe('json-rpc', function () {
		var app;
		var address;

		before(function (done) {
			app = child.fork(
				sandbox,
				{
					cwd: sandbox,
					env: process.env,
					silent: false
				});
			app.on('message', function (message) {
				if (message.type === 'ready') {
					address = message.address;
					done();
				}
				if (message.type === 'error') {
					done(message.error);
				}
			});
			app.on('error', function (error) {
				console.error(error);
			});
			app.on('exit', function (code, signal) {
				if (code !== null && code !== 0) {
					console.log('Server exited with the following code:', code);
				}
				if (signal !== null) {
					console.log('Server stopped after receiveing the following signal:', signal);
				}
			});
		});

		after(function (done) {
			app.kill('SIGTERM');
			done();
		});

		it('should login and run a minimal user command', function (done) {
			var options = { path: '/test/jsonrpc' };
			if (typeof address === 'string') {
				options.socketPath = address;
			} else if (address.port) {
				options.port = address.port;
			}
			var client = jayson.client.http(options);

			async.waterfall([
				function (cb) {
					client.request('ident.login', {
						engineName: 'anonymous',
						credentials: null,
						options: {
							access: 'user'
						}
					}, 1, function (err, response) {
						if (err) {
							return cb(err);
						}

						assert.strictEqual(typeof response, 'object');
						assert.strictEqual(response.jsonrpc, '2.0');
						assert.strictEqual(response.id, 1);
						assert.strictEqual(typeof response.result, 'object');
						assert.strictEqual(typeof response.result.response, 'string');
						assert.strictEqual(typeof response.result.myEvents, 'object');
						var events = {};
						response.result.myEvents.map(function (str) {
							var obj = JSON.parse(str);
							events[obj[0]] = obj[1];
						});
						assert.strictEqual(Object.keys(events).length >= 1, true);
						assert.strictEqual(typeof events['session:set'], 'object');
						assert.strictEqual(typeof events['session:set'].key, 'string');
						cb(null, events['session:set'].key);
					});
				},
				function (sessionKey, cb) {
					client.options.headers = {};
					client.options.headers['X-MAGE-SESSION'] = sessionKey;
					client.request('test.test', [], 2, function (err, response) {
						if (err) {
							cb(err);
							return;
						}

						assert.strictEqual(typeof response, 'object');
						assert.strictEqual(response.jsonrpc, '2.0');
						assert.strictEqual(response.id, 2);
						assert.strictEqual(typeof response.result, 'object');
						assert.strictEqual(typeof response.result.response, 'string');
						assert.strictEqual(JSON.parse(response.result.response), 'test');
						cb();
					});

				}
			], function (error) {
				if (error) {
					console.error(error);
					return done(error);
				}
				done();
			});
		});
	});
});
