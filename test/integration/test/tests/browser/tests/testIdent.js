var assert = require('assert');

describe('Ident module', function () {
	var password = 'password';
	var mage;

	before(function (done) {
		mage = require('mage.js');

		mage.useModules(require, 'ident', 'user');

		mage.setup(function (error) {
			assert.ifError(error);

			mage.user.register(password, function (error, admin) {
				assert.ifError(error);
				assert(admin);

				mage.user.login(admin, password, done);
			});
		});
	});

	it('Cannot login without a username', function (done) {
		mage.user.login(null, null, function (error, result) {
			assert.equal(error, 'invalidUsername');
			assert.equal(result, undefined);

			done();
		});
	});

	it('Cannot login without a password', function (done) {
		mage.user.login('username', null, function (error, result) {
			assert.equal(error, 'invalidPassword');
			assert.equal(result, undefined);

			done();
		});
	});

	it('Cannot login with made up credentials', function (done) {
		mage.user.login('invalidUsername', 'password', function (error, result) {
			assert.equal(error, 'invalidUsername');
			assert.equal(result, undefined);

			done();
		});
	});

	it('Can create a new user and login with it', function (done) {
		mage.user.register(password, function (error, username) {
			assert.ifError(error);
			assert(username, 'no username');

			mage.user.login(username, password, function (error) {
				assert.ifError(error);

				done();
			});
		});
	});

	it('Create a new user, ban them, they cannot login anymore', function (done) {
		mage.user.register(password, function (error, username) {
			assert.ifError(error);
			assert(username);

			mage.user.ban(username, 'testing', function (error) {
				assert.ifError(error);

				mage.user.login(username, password, function (error) {
					assert.equal(error, 'banned');

					mage.user.unban(username, function (error) {
						assert.ifError(error);

						mage.user.login(username, password, function (error) {
							assert.ifError(error);

							done();
						});
					});
				});
			});
		});
	});

	it('Create a new user, login, then restoreSession', function (done) {
		mage.user.register(password, function (error, username) {
			assert.ifError(error);
			assert(username, 'no username');

			mage.user.login(username, password, function (error, results) {
				assert.ifError(error);

				var sessionKey = results.sessionKey;

				mage.session.restore(sessionKey, function (error) {
					assert.ifError(error);

					done();
				});
			});
		});
	});
});
