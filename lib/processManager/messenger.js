var EventEmitter = require('events').EventEmitter;
var util = require('util');

var processManager = require('./');

function Messenger() {
	var that = this;

	if (processManager.isWorker) {
		process.on('message', function (msg) {
			that.emit(msg.name, msg.data);
		});
	}

	function bindMessageListener(worker) {
		worker.on('message', function (msg) {
			that.emit(msg.name, msg.data);
		});
	}

	if (processManager.isMaster) {
		var workers = processManager.getWorkers();
		if (Array.isArray(workers)) {
			workers.forEach(bindMessageListener);
		}
		processManager.on('fork', bindMessageListener);
	}
}

util.inherits(Messenger, EventEmitter);

Messenger.prototype.broadcast = function (message, data) {
	if (!processManager.isMaster) {
		throw new Error('Only the master can send broadcast messages.');
	}

	function broadcast(workers) {
		workers.forEach(function (worker) {
			worker.send({ name: message, data: data });
		});
	}

	// If the processManager is already started, broadcast now
	var workers = processManager.getWorkers();
	if (workers !== undefined) {
		broadcast(workers);
		return;
	}

	// Else wait for the started event
	processManager.on('started', function () {
		var workers = processManager.getWorkers();
		broadcast(workers);
	});
};

Messenger.prototype.send = function (message, data) {
	if (!processManager.isWorker) {
		throw new Error('Only workers can send messages to their parent.');
	}

	process.send({ name: message, data: data });
};

module.exports = new Messenger();
