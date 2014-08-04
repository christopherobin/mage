var assert = require('assert');
var cluster = require('cluster');



cluster.setupMaster({
	exec: __dirname + '/processMessenger-worker.js'
});

cluster.fork();

var messenger = require('../../lib/processMessenger');

describe('processMessenger', function () {
	it('master broadcast/worker echo', function (done) {
		if (cluster.isWorker) {
			return;
		}

		var numberOfWorkers = 3;
		for (var i = 0; i < numberOfWorkers; ++i) {
			cluster.fork();
		}

		var obj = { somekey: 'some value' };

		var received = 0;
		messenger.on('test.test1', function (data) {
			received++;
			assert.deepEqual(data, obj);
			if (received === numberOfWorkers) {
				done();
			}
		});

		messenger.broadcast('test.test1', obj);
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

		messenger.on('test.test3.ok', function () {
			done();
		});

		messenger.broadcast('test.test3.try');
	});
});