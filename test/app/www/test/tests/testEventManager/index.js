var assert = require('assert');

describe('MAGE eventManager', function () {

	var EventManager = require('eventManager');

	var eventManager = new EventManager();

	it('should emit and receive a simple event', function (done) {
		eventManager.once('message', function () {
			done();
		});
		eventManager.emit('message');
	});

	it('should receive a simple event multiple times', function (done) {
		var received = 0;
		eventManager.on('message', function () {
			if (++received === 3) {
				done();
			}
		});
		for (var i = 0; i < 3; ++i) {
			eventManager.emit('message');
		}
	});

	it('should emit custom event', function (done) {
		var received = 0;
		function listener(path, message) {
			assert.strictEqual('test.gifting.gift'.indexOf(path), 0);
			assert.strictEqual(message, 'message');
			if (++received === 3) {
				done();
			}
		}
		eventManager.on('test', listener);
		eventManager.on('test.gifting', listener);
		eventManager.on('test.gifting.gift', listener);
		eventManager.emitEvent('test.gifting.gift', 'message');
	});

	it('should emit multiple custom events', function (done) {
		var received = 0;
		function listener(path, message) {
			assert.strictEqual('test.gifting.gift'.indexOf(path), 0);
			assert.strictEqual(message, 'message');
			if (++received === 6) {
				done();
			}
		}
		function listener2(path, message) {
			assert.strictEqual('test2.gifting.gift'.indexOf(path), 0);
			assert.strictEqual(message, 'message');
			if (++received === 6) {
				done();
			}
		}
		eventManager.on('test', listener);
		eventManager.on('test.gifting', listener);
		eventManager.on('test.gifting.gift', listener);
		eventManager.on('test2', listener2);
		eventManager.on('test2.gifting', listener2);
		eventManager.on('test2.gifting.gift', listener2);
		eventManager.emitEvents([
			['test.gifting.gift', 'message'],
			['test2.gifting.gift', 'message']
		]);
	});
});
