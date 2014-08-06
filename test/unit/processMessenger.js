var assert = require('assert');
var cluster = require('cluster');

// Use a custom script for the workers instead of running mocha
cluster.setupMaster({
	exec: __dirname + '/processMessenger-worker.js'
});

// Run a worker before instantiating the messenger
cluster.fork();

var Messenger = require('../../lib/processMessenger');
var messenger = new Messenger('test');

describe('processMessenger', function () {
	it('master broadcast/worker echo', function (done) {
		var numberOfWorkers = 3;
		for (var i = 0; i < numberOfWorkers; ++i) {
			cluster.fork();
		}

		var obj = { somekey: 'some value' };

		var received = 0;
		messenger.on('test1', function (data) {
			received++;
			assert.deepEqual(data, obj);
			if (received === numberOfWorkers) {
				done();
			}
		});

		messenger.broadcast('test1', obj);
	});

	it('master can send message to its workers', function (done) {
		var worker = cluster.fork();

		messenger.on('test2', function (data, from) {
			assert.strictEqual(from, worker.id);
			done();
		});

		messenger.send(worker.id, 'test2');
	});

	it('master can not send messages to parent', function (done) {
		assert.throws(
			function () {
				messenger.send('master', 'test2');
			},
			Error
		);
		done();
	});

	it('send require a destination', function (done) {
		assert.throws(
			function () {
				messenger.send(null, 'test2');
			},
			Error
		);
		done();
	});

	it('send require a message', function (done) {
		var worker = cluster.fork();

		assert.throws(
			function () {
				messenger.send(worker.id, null);
			},
			Error
		);
		done();
	});

	it('worker can not broadcast', function (done) {
		cluster.fork();

		messenger.on('test3.ok', function () {
			done();
		});

		messenger.broadcast('test3.try');
	});

	it('the namespace should be a string', function (done) {
		assert.throws(
			function () {
				var messenger2 = new Messenger({ test: 1 });
			},
			Error
		);
		done();
	});
});
