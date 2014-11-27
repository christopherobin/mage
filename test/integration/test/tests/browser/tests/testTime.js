var assert = require('assert');

describe('Time module', function () {
	var mage;

	before(function (done) {
		mage = require('mage');

		mage.eventManager.once('io.error', function (path) {
			throw path;
		});

		mage.useModules(require, 'time');

		mage.setup(done);
	});

	it('get the time in seconds and milliseconds', function () {
		assert(mage.time.sec() && isFinite(mage.time.sec()));
		assert(mage.time.msec() && isFinite(mage.time.msec()));
	});

	it('get the time in seconds and milliseconds through the now method', function () {
		assert(mage.time.now() && isFinite(mage.time.now()));
		assert(mage.time.now(true) && isFinite(mage.time.now(true)));
	});
});