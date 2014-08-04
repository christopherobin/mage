var cluster = require('cluster');

if (cluster.isWorker) {
	var messenger = require('../../lib/processMessenger');

	if (cluster.worker.id <= 4) {
		messenger.on('test.test1', function (data) {
			messenger.send('test.test1', data);
		});
	} else if (cluster.worker.id === 5) {
		messenger.on('test.test3.try', function () {
			try {
				messenger.broadcast('test.test3.fail');
			} catch (err) {
				messenger.send('test.test3.ok');
			}
		});
	}
}
