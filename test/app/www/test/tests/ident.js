var assert = require('assert');
var mage = require('mage');

describe('Ident module', function () {
	var password = 'password';

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
		mage.user.login('invalidUserId', 'password', function (error, result) {
			assert.equal(error, 'invalidUserId');
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

			mage.user.ban(username, function (error) {
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

				mage.ident.restoreSession('testEngine', sessionKey, function (error, results) {
					assert.ifError(error);
					assert(results);

					done();
				});
			});
		});
	});
});
