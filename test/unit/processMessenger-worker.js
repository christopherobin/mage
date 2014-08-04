var cluster = require('cluster');

if (cluster.isWorker) {
	var Messenger = require('../../lib/processMessenger');
	var messenger = new Messenger('test');

	if (cluster.worker.id <= 4) {
		messenger.on('test1', function (data) {
			messenger.send('test1', data);
		});
	} else if (cluster.worker.id === 5) {
		messenger.on('test3.try', function () {
			try {
				messenger.broadcast('test3.fail');
			} catch (err) {
				messenger.send('test3.ok');
			}
		});
	}
}
