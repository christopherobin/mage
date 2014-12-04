var assert = require('assert');
var Tome = require('tomes').Tome;

describe('Archivist', function () {
	var mage, userId;

	before(function (done) {
		mage = require('mage.js');

		mage.useModules(require, 'archivist', 'session', 'user');

		mage.setup(function (error) {
			assert.ifError(error);

			var password = 'password';

			mage.user.register(password, function (error, username) {
				assert.ifError(error);
				assert(username);

				mage.user.login(username, password, function (error, sessionData) {
					assert.ifError(error);
					assert(sessionData);

					userId = sessionData.userId;

					assert(userId);

					done();
				});
			});
		});
	});

	describe('mget', function () {
		var scratchData = {
			a: 'a',
			b: 'b',
			c: 'c',
			d: 'd',
			e: 'e',
			f: 'f',
			g: 'g',
			h: 'h',
			i: 'i',
			j: 'j'
		};

		var scratchKeys = Object.keys(scratchData);

		beforeEach(function (done) {
			for (var key in scratchData) {
				mage.archivist.set('scratch', { key: key }, scratchData[key]);
			}

			mage.archivist.distribute(done);
		});

		it('Array style', function (done) {
			var query = [];

			for (var i = 0; i < scratchKeys.length; i += 1) {
				query.push({
					topic: 'scratch',
					index: { key: scratchKeys[i] }
				});
			}

			mage.archivist.mget(query, {}, function (error, data) {
				assert.ifError(error);

				assert(Array.isArray(data));

				for (var i = 0; i < query.length; i += 1) {
					var key = query[i].index.key;

					assert.equal(data[i], scratchData[key]);
				}

				done();
			});
		});

		it('Object style', function (done) {
			var query = {};

			for (var key in scratchData) {
				query[key] = {
					topic: 'scratch',
					index: { key: key }
				};
			}

			mage.archivist.mget(query, {}, function (error, data) {
				assert.ifError(error);

				for (var key in scratchData) {
					assert.equal(data[key], scratchData[key], 'no match');
				}

				done();
			});
		});
	});

	describe('exists', function () {
		it('returns false for non-existing values', function (done) {
			mage.archivist.exists('user', { userId: 'abcxyz' }, function (error, exists) {
				assert.ifError(error);
				assert.strictEqual(exists, false);
				done();
			});
		});

		it('returns true for existing values', function (done) {
			mage.archivist.exists('user', { userId: userId }, { maxAge: 0 }, function (error, exists) {
				assert.ifError(error);
				assert.strictEqual(exists, true);
				done();
			});
		});
	});

	describe('list', function () {
		it('fails bad input', function (done) {
			mage.archivist.list('user', { userId: {} }, {}, function (error, results) {
				assert(error);
				assert(!results);

				mage.archivist.list('user', { userId: false }, {}, function (error, results) {
					assert(error);
					assert(!results);

					done();
				});
			});
		});

		it('fails unknown index keys', function (done) {
			mage.archivist.list('user', { foo: 'bar' }, {}, function (error, results) {
				assert(error);
				assert(!results);
				done();
			});
		});

		it('can list', function (done) {
			mage.archivist.list('user', {}, {}, function (error, results) {
				assert.ifError(error);
				assert(results.length);
				done();
			});
		});
	});

	describe('cached value', function () {
		it('returns true for existing values', function (done) {
			mage.archivist.get('user', { userId: userId }, function (error, data) {
				assert.ifError(error);
				assert(data);

				function listener() {
					throw new Error('Server access during what should be a cached-operation');
				}

				mage.eventManager.on('io.archivist.rawExists', listener);

				mage.archivist.exists('user', { userId: userId }, function (error, exists) {
					assert.ifError(error);
					assert.strictEqual(exists, true);

					mage.eventManager.removeListener('io.archivist.rawExists', listener);
					done();
				});
			});
		});

		it('get', function (done) {
			mage.archivist.get('user', { userId: userId }, {}, function (error, tUser1) {
				assert.ifError(error);

				mage.archivist.get('user', { userId: userId }, {}, function (error, tUser2) {
					assert.ifError(error);
					assert.strictEqual(tUser1, tUser2);

					done();
				});
			});
		});

		it('mget', function (done) {
			var query = {
				user: {
					topic: 'user',
					index: { userId: userId }
				}
			};

			mage.archivist.mget(query, {}, function (error, data1) {
				assert.ifError(error);

				mage.archivist.mget(query, {}, function (error, data2) {
					assert.ifError(error);
					assert.strictEqual(data1.user, data2.user);

					done();
				});
			});
		});
	});

	describe('events order', function () {
		it('Data changes are applied before the usercommand callback is called', function (done) {
			mage.user.setName('Johnny Test', function (error) {
				assert.ifError(error);

				assert.equal(mage.user.name, 'Johnny Test');
				done();
			});
		});
	});

	describe('shard tomes', function () {
		it('Client vault can handle arrayTomes in the shard', function (done) {
			var tData = Tome.conjure([userId, true, 'asdf']);

			mage.archivist.set('shardTest', { userId: userId }, tData);

			mage.archivist.distribute(function (error) {
				assert.ifError(error);

				mage.session.loginAsActor(userId, 'user', function (error) {
					assert.ifError(error);
					mage.archivist.get('shardTest', { userId: userId }, { optional: true, maxAge: 0 }, function (error, result) {
						assert.ifError(error);
						assert.deepEqual(result, tData);

						done();
					});
				});
			});
		});
	});
});
