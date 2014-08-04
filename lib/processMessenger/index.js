var EventEmitter = require('events').EventEmitter;
var util = require('util');
var cluster = require('cluster');

function Messenger() {
	var that = this;

	if (cluster.isWorker) {
		process.on('message', function (msg) {
			that.emit(msg.name, msg.data);
		});
	}

	function bindMessageListener(worker) {
		worker.on('message', function (msg) {
			that.emit(msg.name, msg.data);
		});
	}

	if (cluster.isMaster) {
		var workers = cluster.workers;
		Object.keys(workers).forEach(function (id) {
			bindMessageListener(workers[id]);
		});
		cluster.on('fork', bindMessageListener);
	}
}

util.inherits(Messenger, EventEmitter);

Messenger.prototype.broadcast = function (message, data) {
	if (!cluster.isMaster) {
		throw new Error('Only the master can send broadcast messages.');
	}

	var workers = cluster.workers;
	Object.keys(workers).forEach(function (id) {
		workers[id].send({ name: message, data: data });
	});
};

Messenger.prototype.send = function (message, data) {
	if (!cluster.isWorker) {
		throw new Error('Only workers can send messages to their parent.');
	}

	process.send({ name: message, data: data });
};

module.exports = new Messenger();
