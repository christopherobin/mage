var assert = require('assert');

describe('Server events', function () {
	var mage;
	var fullConfig;

	before(function (done) {
		mage = require('mage');
		fullConfig = mage.config.server.msgStream;

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

	after(function () {
		// reset the message stream to its original configuration

		var success = mage.msgServer.setupMessageStream(fullConfig);

		assert(success, 'could not restore message server configuration');

		mage.msgServer.start();
	});

	it('can receive events from the server during a user command', function (done) {
		mage.eventManager.once('syncEvent', function (evtName, data) {
			assert.strictEqual(evtName, 'syncEvent');
			assert.deepEqual(data, { hello: 'world' });
			done();
		});

		mage.test.synchronousEvent();
	});

	describe('HTTP short-polling', function () {
		it('can receive events from the server after a user command', function (done) {
			var success = mage.msgServer.setupMessageStream({
				transports: {
					shortpolling: fullConfig.transports.shortpolling
				},
				detect: ['shortpolling']
			});

			assert(success, 'could not configure HTTP short-polling stream');

			mage.msgServer.start();

			mage.eventManager.once('asyncEvent', function (evtName, data) {
				assert.strictEqual(evtName, 'asyncEvent');
				assert.deepEqual(data, { hello: 'ShortPolling' });
				done();
			});

			mage.test.asynchronousEvent('ShortPolling');
		});
	});

	describe('HTTP long-polling', function () {
		it('can receive events from the server after a user command', function (done) {
			var success = mage.msgServer.setupMessageStream({
				transports: {
					longpolling: fullConfig.transports.longpolling
				},
				detect: ['longpolling']
			});

			assert(success, 'could not configure HTTP long-polling stream');
			assert.equal(mage.msgServer.stream.constructor.name, 'HttpPollingClient');

			mage.msgServer.start();

			mage.eventManager.once('asyncEvent', function (evtName, data) {
				assert.strictEqual(evtName, 'asyncEvent');
				assert.deepEqual(data, { hello: 'LongPolling' });
				done();
			});

			mage.test.asynchronousEvent('LongPolling');
		});
	});

	describe('WebSocket', function () {
		it('can receive events from the server after a user command', function (done) {
			var success = mage.msgServer.setupMessageStream({
				transports: {
					websocket: fullConfig.transports.websocket
				},
				detect: ['websocket']
			});

			assert(success, 'could not configure WebSocket stream');
			assert.equal(mage.msgServer.stream.constructor.name, 'WebSocketClient');

			mage.msgServer.start();

			mage.eventManager.once('asyncEvent', function (evtName, data) {
				assert.strictEqual(evtName, 'asyncEvent');
				assert.deepEqual(data, { hello: 'WebSocket' });
				done();
			});

			mage.test.asynchronousEvent('WebSocket');
		});
	});

	describe('Server gone behavior', function () {
		it('Disconnects session when its host cannot be located', function (done) {
			mage.eventManager.once('session.unset', function (evtName, data) {
				assert.strictEqual(evtName, 'session.unset');
				assert.strictEqual(data, 'hostGone');
				done();
			});

			mage.test.corruptSessionHost();
		});
	});
});
