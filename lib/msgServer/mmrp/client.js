var zmq	 = require('zmq'),
    util = require('util'),
    meta = require('./meta'),
    Meta = meta.Meta,
    EventEmitter = require('events').EventEmitter;


function Client(clientSocketAddrs) {
	if (!Array.isArray(clientSocketAddrs)) {
		clientSocketAddrs = [clientSocketAddrs];
	}

	this.socket = new zmq.createSocket('xreq');

	for (var i = 0, len = clientSocketAddrs.length; i < len; i++) {
		this.socket.connect(clientSocketAddrs[i]);
	}

	var _this = this;

	this.socket.on('message', function () {
		console.log('Message received');

		_this.parseMessage.call(_this, Array.prototype.slice.call(arguments));
	});
}


util.inherits(Client, EventEmitter);


exports.Client = Client;


Client.prototype.parseMessage = function (packet) {
	var metadata   = new Meta(packet[packet.length - 1]);
	var data	   = packet[metadata.dataPosition];
	var sendToAddr = packet.slice(0, metadata.dataPosition);

	// We auto deserialize whenever we want

	if (metadata.flags & meta.FLAGS.AUTO_DESERIALIZE) {
		data = metadata.deserialize(data);
	}

	console.log('emitting message');

	this.emit('message', sendToAddr, data, metadata);
};


Client.prototype.send = function (addr, data, metadata) {
	// Parse the address if it is in its string format

	if (typeof addr === 'string') {
		addr = addr.split('/');
	}

	// Package metadata
	if (!metadata) {
		metadata = new Meta();
	}

	metadata.dataPosition = addr.length;

	// Create a packet that is the address, plus data and metadata to our packet (without touching the original address array)

	var packet = addr.concat(data, metadata.data);

	this.socket.send.apply(this.socket, packet);
};

