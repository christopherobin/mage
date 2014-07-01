var assert = require('assert');
var child = require('child_process');
var path = require('path');

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
		var clientOptions = { path: '/test/jsonrpc' };

		before(function (done) {
			app = child.fork(
				sandbox,
				{
					cwd: sandbox,
					env: process.env,
					silent: true
				});
			app.on('message', function (message) {
				if (message.type === 'ready') {
					var address = message.address;
					if (typeof address === 'string') {
						clientOptions.socketPath = address;
					} else if (address.port) {
						clientOptions.port = address.port;
					}
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

		describe('without session', function () {
			it('should be able to obtain a new session', function (done) {
				var client = jayson.client.http(clientOptions);
				client.request('ident.login', {
					engineName: 'anonymous',
					credentials: null,
					options: {
						access: 'user'
					}
				}, 1, function (err, response) {
					if (err) {
						return done(err);
					}


					assert.strictEqual(typeof response, 'object');
					assert.strictEqual(response.jsonrpc, '2.0');
					assert.strictEqual(response.id, 1);
					assert.strictEqual(typeof response.result, 'object');
					assert.strictEqual(typeof response.error, 'undefined');
					assert.strictEqual(typeof response.result.response, 'object');
					assert.strictEqual(typeof response.result.response.user, 'object');
					assert.strictEqual(typeof response.result.response.user.userId, 'string');
					assert.strictEqual(typeof response.result.response.user.displayName, 'string');
					assert.strictEqual(typeof response.result.response.session, 'object');
					assert.strictEqual(typeof response.result.response.session.key, 'string');
					assert.strictEqual(typeof response.result.response.session.actorId, 'string');
					assert.strictEqual(typeof response.result.myEvents, 'object');
					var events = {};
					response.result.myEvents.map(function (str) {
						var obj = JSON.parse(str);
						events[obj[0]] = obj[1];
					});
					assert.strictEqual(Object.keys(events).length >= 1, true);
					assert.strictEqual(typeof events['session:set'], 'object');
					assert.strictEqual(typeof events['session:set'].key, 'string');
					done();
				});
			});

			it('should send an error on invalid session key', function (done) {
				var client = jayson.client.http(clientOptions);

				client.options.headers = {};
				client.options.headers['X-MAGE-SESSION'] = 'invalidSessionKey';

				client.request('test.test', {}, 2, function (err, response) {
					assert.strictEqual(typeof response, 'undefined');

					assert.strictEqual(typeof err, 'object');
					assert.strictEqual(typeof err.message, 'string');
					var message = JSON.parse(err.message);
					assert.strictEqual(message.jsonrpc, '2.0');
					assert.strictEqual(message.id, 2);
					assert.strictEqual(typeof message.error, 'object');
					assert.strictEqual(message.error.code, jayson.Server.errors.INTERNAL_ERROR);
					assert.strictEqual(typeof message.result, 'undefined');
					done();
				});
			});

			it('should send an error for each request in the batch on invalid session key', function (done) {
				var client = jayson.client.http(clientOptions);

				client.options.headers = {};
				client.options.headers['X-MAGE-SESSION'] = 'invalidSessionKey';

				var batch = [
					client.request('test.test', {}, 3),
					client.request('test.testwithargs', {
						arg1: 'a',
						arg2: 'b',
						arg3: 'c'
					}, 4),
					client.request('test.test', {}, 5)
				];

				client.request(batch, function (err, response) {
					assert.strictEqual(typeof response, 'undefined');
					assert.strictEqual(typeof err, 'object');
					assert.strictEqual(typeof err.message, 'string');
					var messages = JSON.parse(err.message);
					messages.forEach(function (message) {
						assert.strictEqual(message.jsonrpc, '2.0');
						assert.strictEqual([3, 4, 5].indexOf(message.id) >= 0, true);
						assert.strictEqual(typeof message.error, 'object');
						assert.strictEqual(message.error.code, jayson.Server.errors.INTERNAL_ERROR);
						assert.strictEqual(typeof message.result, 'undefined');
					});
					done();
				});
			});
		});

		describe('with session', function () {
			var client;

			before(function (done) {
				client = jayson.client.http(clientOptions);
				client.request('ident.login', {
					engineName: 'anonymous',
					credentials: null,
					options: {
						access: 'user'
					}
				}, 1, function (err, response) {
					if (err) {
						return done(err);
					}

					var events = {};
					response.result.myEvents.map(function (str) {
						var obj = JSON.parse(str);
						events[obj[0]] = obj[1];
					});

					client.options.headers = {};
					client.options.headers['X-MAGE-SESSION'] = events['session:set'].key;

					done();
				});
			});

			it('should send a notification', function (done) {
				client.request('test.test', {}, null, function (err, response) {
					if (err) {
						done(err);
						return;
					}

					assert.strictEqual(typeof response, 'undefined');
					done();
				});
			});

			it('should run a command without arguments', function (done) {
				client.request('test.test', {}, 2, function (err, response) {
					if (err) {
						done(err);
						return;
					}

					assert.strictEqual(typeof response, 'object');
					assert.strictEqual(response.jsonrpc, '2.0');
					assert.strictEqual(response.id, 2);
					assert.strictEqual(typeof response.error, 'undefined');
					assert.strictEqual(typeof response.result, 'object');
					assert.strictEqual(typeof response.result.response, 'string');
					assert.strictEqual(response.result.response, 'test');
					done();
				});
			});

			it('should not update the object after the respond call', function (done) {
				client.request('test.test-postupdate', {}, 2, function (err, response) {
					if (err) {
						done(err);
						return;
					}

					assert.strictEqual(typeof response, 'object');
					assert.strictEqual(response.jsonrpc, '2.0');
					assert.strictEqual(response.id, 2);
					assert.strictEqual(typeof response.error, 'undefined');
					assert.strictEqual(typeof response.result, 'object');
					assert.strictEqual(typeof response.result.response, 'object');
					assert.deepEqual(response.result.response, {
						a: 5,
						b: 6
					});
					done();
				});
			});

			it('should run a command with positional arguments', function (done) {
				client.request('test.testwithargs', ['a', 'b', 'c'], 2, function (err, response) {
					if (err) {
						done(err);
						return;
					}

					assert.strictEqual(typeof response, 'object');
					assert.strictEqual(response.jsonrpc, '2.0');
					assert.strictEqual(response.id, 2);
					assert.strictEqual(typeof response.error, 'undefined');
					assert.strictEqual(typeof response.result, 'object');
					assert.strictEqual(typeof response.result.response, 'object');
					assert.strictEqual(response.result.response.length, 3);
					assert.deepEqual(response.result.response, ['a', 'b', 'c']);
					done();
				});
			});

			it('should run a command with positional arguments with one missing', function (done) {
				client.request('test.testwithargs', ['a', 'b'], 2, function (err, response) {
					if (err) {
						done(err);
						return;
					}

					assert.strictEqual(typeof response, 'object');
					assert.strictEqual(response.jsonrpc, '2.0');
					assert.strictEqual(response.id, 2);
					assert.strictEqual(typeof response.error, 'undefined');
					assert.strictEqual(typeof response.result, 'object');
					assert.strictEqual(typeof response.result.response, 'object');
					assert.strictEqual(response.result.response.length, 3);
					assert.deepEqual(response.result.response, ['a', 'b', null]);
					done();
				});
			});

			it('should throw an exception if there are too many args', function (done) {
				client.request('test.testwithargs', ['a', 'b', 'c', 'd'], 2, function (err, response) {
					if (err) {
						done(err);
						return;
					}

					assert.strictEqual(typeof response, 'object');
					assert.strictEqual(response.jsonrpc, '2.0');
					assert.strictEqual(response.id, 2);
					assert.strictEqual(typeof response.error, 'object');
					assert.strictEqual(response.error.code, jayson.Server.errors.INVALID_PARAMS);
					assert.strictEqual(typeof response.result, 'undefined');
					done();
				});
			});

			it('should run a command with named parameters', function (done) {
				client.request('test.testwithargs', {
					arg1: 'a',
					arg2: 'b',
					arg3: 'c'
				}, 2, function (err, response) {
					if (err) {
						done(err);
						return;
					}

					assert.strictEqual(typeof response, 'object');
					assert.strictEqual(response.jsonrpc, '2.0');
					assert.strictEqual(response.id, 2);
					assert.strictEqual(typeof response.error, 'undefined');
					assert.strictEqual(typeof response.result, 'object');
					assert.strictEqual(typeof response.result.response, 'object');
					assert.strictEqual(response.result.response.length, 3);
					assert.deepEqual(response.result.response, ['a', 'b', 'c']);
					done();
				});
			});

			it('should run a Batch', function (done) {
				var batch = [
					client.request('test.test', {}, 3),
					client.request('test.testwithargs', {
						arg1: 'a',
						arg2: 'b',
						arg3: 'c'
					}, 4),
					client.request('foobar', {}, 5),      // invalid user command
					client.request('test.test', {}, null) // notification
				];
				client.request(batch, function (err, responses) {
					if (err) {
						done(err);
						return;
					}

					assert.strictEqual(typeof responses, 'object');
					assert.strictEqual(responses instanceof Array, true);
					assert.strictEqual(responses.length, 3);
					responses.forEach(function (response) {
						assert.strictEqual(response.jsonrpc, '2.0');
						assert.strictEqual(typeof response.id, 'number');
						assert.strictEqual([3, 4, 5].indexOf(response.id) >= 0, true);
						switch (response.id) {
							case 3:
								assert.strictEqual(typeof response.error, 'undefined');
								assert.strictEqual(typeof response.result.response, 'string');
								assert.strictEqual(response.result.response, 'test');
								break;
							case 4:
								assert.strictEqual(typeof response.error, 'undefined');
								assert.strictEqual(typeof response.result.response, 'object');
								assert.strictEqual(response.result.response.length, 3);
								assert.deepEqual(response.result.response, ['a', 'b', 'c']);
								break;
							case 5:
								assert.strictEqual(typeof response.result, 'undefined');
								assert.strictEqual(typeof response.error, 'object');
								assert.strictEqual(response.error.code, -32601);
								assert.strictEqual(response.error.message, 'Method not found');
								break;
							default:
								assert(false, 'Unexpected response');
								break;
						}
					});
					done();
				});
			});
		});
	});
});
