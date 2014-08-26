// tests the library that integrates MMRP, Store, Message Stream, Service Discovery

var assert = require('assert');

require('../..'); // register mage in codependency
var Store = require('../../lib/msgServer/store').Store;

describe('Message Store', function () {
	it('instantiates', function () {
		var store = new Store();
		store.close();
	});

	it('does not accept bad connections', function () {
		var store = new Store();

		assert.throws(function () {
			store.connectAddress([], 'never');
		});

		assert.throws(function () {
			store.connectAddress(['hello'], 'abc');
		});

		store.close();
	});

	it('can send many times to a never disconnecting client', function () {
		var store = new Store();

		var route = ['abc', 'def'];
		var emitted = 0;
		var ids;

		store.on('forward', function (payload, targetRoute) {
			emitted += 1;
			assert.equal(payload.length, 3 * 2 * emitted);
			assert.deepEqual(route, targetRoute);

			ids = [];
			for (var i = 0; i < payload.length; i += 2) {
				ids.push(payload[i]);
			}
		});

		store.connectAddress(route, 'never');
		assert(store.isConnected('def'));

		store.send('def', ['hello', 'world', '1']);
		assert(store.isConnected('def'));
		store.send('def', ['goodbye', 'world', '1']);
		assert(store.isConnected('def'));
		store.send('def', ['hello', 'world', '2']);
		assert(store.isConnected('def'));
		store.send('def', ['goodbye', 'world', '2']);
		assert(store.isConnected('def'));
		assert.equal(emitted, 4);

		// confirm all messages, and now see what we receive
		store.confirm('def', ids);
		emitted = 0;
		store.send('def', ['goodbye', 'world', '2']);
		assert(store.isConnected('def'));
		assert.equal(emitted, 1);

		store.close();
	});

	it('can broadcast to many people in the store', function () {
		var store = new Store();
		var a = ['abc', 'def'];
		var b = ['xyz', 'uvw'];
		var emitted = 0;

		store.on('forward', function (payload, targetRoute) {
			emitted += 1;
			assert.equal(payload.length, 4);

			if (targetRoute[1] === 'def') {
				assert.deepEqual(a, targetRoute);
			} else {
				assert.deepEqual(b, targetRoute);
			}
		});

		store.connectAddress(a, 'never');
		store.connectAddress(b, 'never');
		assert(store.isConnected('def'));
		assert(store.isConnected('uvw'));

		store.broadcast(['hello', 'world']);
		assert.equal(emitted, 2);

		store.close();
	});

	it('auto disconnects when needed (ondelivery)', function () {
		var store = new Store();

		var route = ['abc', 'def'];
		var emitted = 0;
		var ids;

		store.on('forward', function (payload, targetRoute) {
			emitted += 1;
			assert.equal(payload.length, 3 * 2 * emitted);
			assert.deepEqual(route, targetRoute);

			ids = [];
			for (var i = 0; i < payload.length; i += 2) {
				ids.push(payload[i]);
			}
		});

		store.connectAddress(route, 'ondelivery');
		assert(store.isConnected('def'));

		store.send('def', ['hello', 'world', '1']);
		assert(!store.isConnected('def'));
		assert.equal(emitted, 1);

		store.send('def', ['hello', 'world', '1']);
		assert(!store.isConnected('def'));
		assert.equal(emitted, 1);

		store.close();
	});

	it('auto disconnects when needed (always)', function () {
		var store = new Store();

		var route = ['abc', 'def'];
		var emitted = 0;
		var ids;
		var expectedLen = 0;

		store.on('forward', function (payload, targetRoute) {
			emitted += 1;

			assert.equal(payload.length, expectedLen);
			assert.deepEqual(route, targetRoute);

			ids = [];
			for (var i = 0; i < payload.length; i += 2) {
				ids.push(payload[i]);
			}
		});

		store.connectAddress(route, 'always');
		assert(!store.isConnected('def'));
		assert.equal(emitted, 1);

		store.send('def', ['foo']);
		expectedLen += 2;
		store.send('def', ['foo']);
		expectedLen += 2;
		store.send('def', ['foo']);
		expectedLen += 2;
		assert(!store.isConnected('def'));
		assert.equal(emitted, 1);

		store.connectAddress(route, 'always');
		assert.equal(emitted, 2);

		store.close();
	});
});
