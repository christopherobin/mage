var EventEmitter = require('events').EventEmitter;
var util = require('util');
var cluster = require('cluster');

function Messenger(namespace) {
	if (!namespace) {
		throw new Error('A namespace is required to use the process messenger.');
	}

	if (Object.prototype.toString.call(namespace) !== '[object String]') {
		throw new Error('The namespace must be a string.');
	}

	this.namespace = namespace;

	var that = this;

	if (cluster.isWorker) {
		process.on('message', function (msg) {
			if (msg.namespace === namespace) {
				that.emit(msg.name, msg.data, 'master');
			}
		});
	}

	function bindMessageListener(worker) {
		worker.on('message', function (msg) {
			if (msg.namespace === namespace) {
				that.emit(msg.name, msg.data, worker.id);
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
			namespace: this.namespace,
			name: message,
			data: data
		});
	}, this);
};

Messenger.prototype.send = function (to, message, data) {
	if (!to) {
		throw new Error('You must specify a destination to send a message.');
	}

	if (!message) {
		throw new Error('You must specify a message name to send a message.');
	}

	var target = null;

	if (cluster.isWorker) {
		if (to !== 'master') {
			throw new Error('Workers can only send messages to their parent.');
		}
		target = process;
	} else {
		var worker = cluster.workers[to];
		if (!worker) {
			throw new Error('There is no worker with this id.');
		}
		target = worker;
	}

	target.send({
		namespace: this.namespace,
		name: message,
		data: data
	});
};

module.exports = Messenger;
