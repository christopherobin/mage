var assert = require('assert');
var mage = require('mage');

describe('Session module', function () {
	before(function (done) {
		if (!mage.session.getKey()) {
			return done();
		}

		mage.session.logout(done);
	});

	it('anonymous login', function (done) {
		assert.strictEqual(mage.httpServer.cmdHooks.length, 0);

		mage.session.loginAnonymous('admin', function (error) {
			assert.ifError(error);
			assert.strictEqual(mage.httpServer.cmdHooks.length, 1);
			done();
		});
	});

	it('isValidSession', function (done) {
		assert(mage.session.getKey());

		mage.session.isValidSession(mage.session.getKey(), function (error, isValid) {
			assert.ifError(error);
			assert(isValid);
			done();
		});
	});

	mage.eventManager.on('io.error', function (path) {
		throw path;
	});

	it('can log out', function (done) {
		mage.session.logout(function (error) {
			assert.ifError(error);
			assert.strictEqual(mage.httpServer.cmdHooks.length, 0);
			done();
		});
	});

	describe('Login input tests', function () {
		after(function (done) {
			mage.session.logout(function (error) {
				assert.ifError(error);
				done();
			});
		});

		it('cannot login as a falsy actor ID', function (done) {
			assert(!mage.session.getKey());

			mage.session.loginAsActor(null, 'admin', function (error) {
				assert(error);
				done();
			});
		});

		var num = 12345;

		it('can login as a random actor ID', function (done) {
			mage.session.loginAsActor(num, 'admin', function (error) {
				assert.ifError(error);
				assert.strictEqual(String(num), mage.session.getActorId());
				done();
			});
		});

		it('cannot reassign a session to a falsy actor ID', function (done) {
			mage.session.reassignSession(null, null, function (error) {
				assert(error);
				assert.strictEqual(String(num), mage.session.getActorId());
				done();
			});
		});

		it('can reassign a session to another random actor ID', function (done) {
			mage.session.reassignSession(null, num + 1, function (error) {
				assert.ifError(error);
				assert.strictEqual(String(num + 1), mage.session.getActorId());
				done();
			});
		});

		it('is still a valid session', function (done) {
			assert(mage.session.getKey());

			mage.session.isValidSession(mage.session.getKey(), function (error, isValid) {
				assert.ifError(error);
				assert(isValid);
				assert.strictEqual(String(num + 1), mage.session.getActorId());
				done();
			});
		});
	});
});
