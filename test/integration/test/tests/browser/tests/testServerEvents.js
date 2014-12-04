var assert = require('assert');

describe('Server events', function () {
	var mage;

	before(function (done) {
		mage = require('mage.js');
		mage.session.loginAnonymous('admin', function (error) {
			assert.ifError(error);
			assert(mage.session.getKey());

			mage.useModules(require, 'test');

			mage.setup(function (error) {
				assert.ifError(error);

				done();
			});
		});
	});

	it('can receive events from the server during a user command', function (done) {
		mage.eventManager.on('syncEvent', function (evtName, data) {
			assert.strictEqual(evtName, 'syncEvent');
			assert.deepEqual(data, { hello: 'world' });
			done();
		});

		mage.test.synchronousEvent();
	});

	it('can receive events from the server after a user command', function (done) {
		mage.eventManager.on('asyncEvent', function (evtName, data) {
			assert.strictEqual(evtName, 'asyncEvent');
			assert.deepEqual(data, { hello: 'async' });
			done();
		});

		mage.test.asynchronousEvent();
	});
});
