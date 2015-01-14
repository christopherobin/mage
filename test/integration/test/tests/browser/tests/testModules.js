var assert = require('assert');

describe('Funky modules', function () {
	var mage;

	before(function (done) {
		mage = require('mage');

		mage.useModules(require, 'no-uc');

		mage.setup(function (error) {
			assert.ifError(error);

			done();
		});
	});

	it('allows module names with dashes', function () {
		assert(mage['no-uc']);
	});

	it('exposes no user commands on no-uc test module', function () {
		var keys = Object.keys(mage['no-uc']);
		assert.deepEqual(keys, ['foo']);
		assert.strictEqual(mage['no-uc'].foo, 5);
	});
});
