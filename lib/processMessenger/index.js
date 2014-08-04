var EventEmitter = require('events').EventEmitter;
var util = require('util');
var cluster = require('cluster');

function Messenger(namespace) {
	if (!namespace) {
		throw new Error('A namespace is required to use the process messenger.');
	}

	this.namespace = namespace;

	var that = this;

	if (cluster.isWorker) {
		process.on('message', function (msg) {
			if (msg.name.indexOf(namespace) === 0) {
				that.emit(msg.name.substr(namespace.length + 1), msg.data);
			}
		});
	}

	function bindMessageListener(worker) {
		worker.on('message', function (msg) {
			if (msg.name.indexOf(namespace) === 0) {
				that.emit(msg.name.substr(namespace.length + 1), msg.data);
			}
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
		workers[id].send({
			name: [this.namespace, message].join('.'),
			data: data
		});
	}, this);
};

Messenger.prototype.send = function (message, data) {
	if (!cluster.isWorker) {
		throw new Error('Only workers can send messages to their parent.');
	}

	process.send({
		name: [this.namespace, message].join('.'),
		data: data
	});
};

module.exports = Messenger;
