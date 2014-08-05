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

	it('master can not send messages to parent', function (done) {
		assert.throws(
			function () {
				messenger.send('test.test2');
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
});
