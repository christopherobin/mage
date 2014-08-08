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
			if (msg.namespace !== namespace) {
				return;
			}

			that.emit(msg.name, msg.data, msg.from);
		});
	}

	function bindMessageListener(worker) {
		worker.on('message', function (msg) {
			if (msg.namespace !== namespace) {
				return;
			}

			if (msg.to === '*') {
				that.broadcast(msg.name, msg.data, msg.from);
			}

			if (msg.to === 'master' || msg.to === '*') {
				that.emit(msg.name, msg.data, msg.from);
				return;
			}

			that.send(msg.to, msg.name, msg.data, msg.from);
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

Messenger.prototype.broadcast = function (message, data, from) {
	if (!cluster.isMaster) {
		process.send({
			namespace: this.namespace,
			from: cluster.worker.id,
			to: '*',
			name: message,
			data: data
		});
		return;
	}

	var workers = cluster.workers;
	Object.keys(workers).forEach(function (id) {
		workers[id].send({
			namespace: this.namespace,
			from: from || 'master',
			to: id,
			name: message,
			data: data
		});
	}, this);
};

Messenger.prototype.send = function (to, message, data, from) {
	if (!to) {
		throw new Error('You must specify a destination to send a message.');
	}

	if (!message) {
		throw new Error('You must specify a message name to send a message.');
	}

	var target = null;

	if (cluster.isWorker) {
		target = process;
		if (!from) {
			from = cluster.worker.id;
		}
	} else {
		var worker = cluster.workers[to];
		if (!worker) {
			throw new Error('There is no worker with this id.');
		}
		target = worker;
		if (!from) {
			from = 'master';
		}
	}

	target.send({
		namespace: this.namespace,
		from: from,
		to: to,
		name: message,
		data: data
	});
};

module.exports = Messenger;
