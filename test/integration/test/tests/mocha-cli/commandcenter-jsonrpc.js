var assert = require('assert');

var jayson = require('jayson');

describe('commandCenter', function () {
	describe('json-rpc', function () {
		var clientOptions = { path: '/test/jsonrpc' };

		before(function (done) {
			var address = JSON.parse(process.env.MAGE_APP_ADDRESS);
			clientOptions.hostname = address.address;
			clientOptions.port = address.port;
			done();
		});

		describe('without session', function () {
			it('should send number errors as string', function (done) {
				var client = jayson.client.http(clientOptions);

				client.request('test.test-errors', { testType: 'number' }, 1, function (err, response) {
					assert.ifError(err);
					assert.strictEqual(response.result.errorCode, '0');
					done();
				});
			});

			it('should send Error objects as string', function (done) {
				var client = jayson.client.http(clientOptions);

				client.request('test.test-errors', { testType: 'Error' }, 1, function (err, response) {
					assert.ifError(err);
					assert.strictEqual(response.result.errorCode, 'This is an Error object');
					done();
				});
			});

			it('should send assertion errors as string', function (done) {
				var client = jayson.client.http(clientOptions);

				client.request('test.test-errors', { testType: 'assert' }, 1, function (err, response) {
					assert.ifError(err);
					assert.strictEqual(response.result.errorCode, 'assertion failed');
					done();
				});
			});

			it('should send string errors as string', function (done) {
				var client = jayson.client.http(clientOptions);

				client.request('test.test-errors', { testType: 'string' }, 1, function (err, response) {
					assert.ifError(err);
					assert.strictEqual(response.result.errorCode, 'string');
					done();
				});
			});

			it('should send object errors as toString()', function (done) {
				var client = jayson.client.http(clientOptions);

				client.request('test.test-errors', { testType: 'object' }, 1, function (err, response) {
					assert.ifError(err);
					assert.strictEqual(response.result.errorCode, '[object Object]');
					done();
				});
			});

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

					assert.strictEqual(typeof response.error, 'undefined');

					assert.strictEqual(typeof response.result, 'object');
					assert.strictEqual(typeof response.result.response, 'object');
					assert.strictEqual(typeof response.result.response.key, 'string');
					assert.strictEqual(typeof response.result.response.actorId, 'string');
					assert.strictEqual(typeof response.result.response.meta, 'object');

					assert.strictEqual(typeof response.result.myEvents, 'object');

					var events = {};
					response.result.myEvents.map(function (str) {
						var obj = JSON.parse(str);
						events[obj[0]] = obj[1];
					});

					assert.strictEqual(Object.keys(events).length >= 1, true);
					assert.strictEqual(typeof events['session.set'], 'object');
					assert.strictEqual(typeof events['session.set'].key, 'string');

					done();
				});
			});

			it('should send an error on invalid session key', function (done) {
				var client = jayson.client.http(clientOptions);

				client.options.headers = {};
				client.options.headers['X-MAGE-SESSION'] = 'invalidSessionKey';

				client.request('test.test', {}, 2, function (err, response) {
					assert.ifError(err);

					assert.strictEqual(typeof response, 'object');
					assert.strictEqual(response.jsonrpc, '2.0');
					assert.strictEqual(response.id, 2);
					assert.strictEqual(typeof response.result, 'object');
					assert.strictEqual(response.result.errorCode, 'auth');

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

				client.request(batch, function (err, responses) {
					assert.ifError(err);

					assert(Array.isArray(responses));
					assert.equal(responses.length, 3);

					for (var i = 0; i < responses.length; i += 1) {
						var response = responses[i];

						assert.strictEqual(response.jsonrpc, '2.0');
						assert.strictEqual(i + 3, response.id);
						assert.strictEqual(typeof response.result, 'object');
						assert.strictEqual(response.result.errorCode, 'auth');
					}

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
					client.options.headers['X-MAGE-SESSION'] = events['session.set'].key;

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
