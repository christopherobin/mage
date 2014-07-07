var assert = require('assert');
var mage = require('mage');

describe('Ident module', function () {
	var password = 'password';

	it('Cannot login without a username', function (done) {
		mage.user.login(null, null, function (error, result) {
			assert.equal(error, 'ident');
			assert.equal(result, undefined);

			done();
		});
	});

	it('Cannot login without a password', function (done) {
		mage.user.login('username', null, function (error, result) {
			assert.equal(error, 'ident');
			assert.equal(result, undefined);

			done();
		});
	});

	it('Cannot login with made up credentials', function (done) {
		mage.user.login('unitId', 'password', function (error, result) {
			assert.equal(error, 'ident');
			assert.equal(result, undefined);

			done();
		});
	});

	it('Can create a new user and login with it using register and login separately', function (done) {
		mage.user.register(password, function (error, unitId) {
			assert.ifError(error);
			assert(unitId);

			mage.user.login(unitId, password, function (error) {
				assert.ifError(error);

				done();
			});
		});
	});

	it('Can create a user and login with it using login', function (done) {
		mage.user.login('new', password, function (error) {
			assert.ifError(error);

			done();
		});
	});

	it('User information should be accessible under mage.ident.user', function (done) {
		mage.user.login('new', password, function (error) {
			assert.ifError(error);

			assert.strictEqual(typeof mage.ident.user.userId, 'string');
			assert.strictEqual(typeof mage.ident.user.displayName, 'string');

			done();
		});
	});
});
