var cluster = require('cluster');

if (cluster.isWorker) {
	var Messenger = require('../../lib/processMessenger');
	var messenger = new Messenger('test');

	if (cluster.worker.id <= 4) {
		messenger.on('test1', function (data) {
			messenger.send('master', 'test1', data);
		});
	} else if (cluster.worker.id === 5) {
		messenger.on('test2', function () {
			messenger.send('master', 'test2');
		});
	} else if (cluster.worker.id === 6) {
		messenger.on('test3.try', function () {
			try {
				messenger.broadcast('test3.fail');
			} catch (err) {
				messenger.send('master', 'test3.ok');
			}
		});
	}
}
