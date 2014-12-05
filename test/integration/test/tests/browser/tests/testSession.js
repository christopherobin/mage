var assert = require('assert');

describe('Session module', function () {
	var mage;

	before(function (done) {
		mage = require('mage');

		mage.eventManager.on('io.error', function (path) {
			throw path;
		});

		mage.useModules(require, 'session');

		mage.setup(function (error) {
			assert.ifError(error);

			if (!mage.session.getKey()) {
				return done();
			}

			mage.session.logout(done);
		});
	});

	it('anonymous login', function (done) {
		assert(!mage.session.getKey());

		mage.session.loginAnonymous('admin', function (error) {
			assert.ifError(error);
			assert(mage.session.getKey());

			done();
		});
	});

	it('can log out', function (done) {
		assert(mage.session.getKey());

		mage.session.logout(function (error) {
			assert.ifError(error);
			assert(!mage.session.getKey());

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

		var actorId1 = '12345';
		var actorId2 = '67890';

		it('can login as a random actor ID', function (done) {
			mage.session.loginAsActor(actorId1, 'admin', function (error) {
				assert.ifError(error);
				assert.strictEqual(actorId1, mage.session.getActorId());

				done();
			});
		});

		it('cannot reassign a session to a falsy actor ID', function (done) {
			mage.session.reassign(null, null, function (error) {
				assert(error);
				assert.strictEqual(actorId1, mage.session.getActorId());

				done();
			});
		});

		it('cannot reassign a sesssion from an actorId that doesn\'t have a session yet', function (done) {
			mage.session.reassign(actorId2, actorId2, function (error) {
				assert.equal(error, 'invalidSession');
				assert.strictEqual(actorId1, mage.session.getActorId());

				done();
			});
		});

		it('can reassign a session to another random actor ID', function (done) {
			mage.session.reassign(null, actorId2, function (error) {
				assert.ifError(error);
				assert.strictEqual(actorId2, mage.session.getActorId());

				done();
			});
		});
	});
});
