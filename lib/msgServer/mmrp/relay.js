var zmq	= require('zmq'),
    util = require('util'),
    meta = require('./meta'),
    Meta = meta.Meta,
    EventEmitter = require('events').EventEmitter;


function Relay(identity, xrepSocketAddrs, xreqSocketAddrs) {
	if (xrepSocketAddrs && !Array.isArray(xrepSocketAddrs)) {
		xrepSocketAddrs = [xrepSocketAddrs];
	}

	if (xreqSocketAddrs && !Array.isArray(xreqSocketAddrs)) {
		xreqSocketAddrs = [xreqSocketAddrs];
	}

	this.xrepSocket = new zmq.createSocket('xrep');
	this.xreqSocket = new zmq.createSocket('xreq');
	this.xreqSocket.identity = identity;
	this.identity = identity;

	// Messages coming in from here are

	var i, len;

	if (xrepSocketAddrs) {
		for (i = 0, len = xrepSocketAddrs.length; i < len; i++) {
			this.xrepSocket.bindSync(xrepSocketAddrs[i]);
		}
	}

	var _this = this;

	this.xrepSocket.on('message', function (receivedFrom) {
		var packet = Array.prototype.slice.call(arguments, 1);

		var metadata = new Meta(packet[packet.length - 1]);

		// Shuffle the injected source to the top of the return path

		if (metadata.flags & meta.FLAGS.REPLY_EXPECTED) {
			packet.splice(metadata.dataPosition + 1, 0, receivedFrom);
		}

		_this.handlePacket(metadata, packet, 'request');
	});


	this.xreqSocket.on('message', function () {
		var packet = Array.prototype.slice.call(arguments);

		var metadata = new Meta(packet[packet.length - 1]);

		_this.handlePacket(metadata, packet, 'reply');
	});

	if (xreqSocketAddrs) {
		for (i = 0, len = xreqSocketAddrs.length; i < len; i++) {
			this.xreqSocket.connect(xreqSocketAddrs[i]);
		}
	}
}


util.inherits(Relay, EventEmitter);


exports.Relay = Relay;


Relay.prototype.close = function () {
	this.xreqSocket.close();
	this.xrepSocket.close();
};


Relay.prototype.handlePacket = function (metadata, packet, eventType) {
	var data, returnPath;

	// We apply basic cleanup. if we have a stack of addresses
	// which point to us, we remove them from the stack.
	// Eventually, this would be able to be more clever,
	// but as the stack will grow, it will be technically
	// possible to have one adress which refers to more than one
	// machine (assuming those machines are on different networks).

	while (packet[0].toString() === this.identity) {
		metadata.dataPosition--;
		packet.shift();
	}

	if (metadata.dataPosition === 0) {
		// If we are the destination of the data, emit an event with the request's data
		// And the address it came from

		data = packet.shift();

		if (metadata.flags & meta.FLAGS.REPLY_EXPECTED) {
			returnPath = packet.slice(0, -1);
		}

		if (metadata.flags & meta.FLAGS.AUTO_DESERIALIZE) {
			data = metadata.deserialize(data);
		}

		this.emit('message', data, returnPath, metadata);

	} else if (this.listeners(eventType).length === 0) {
		// If we do not have any event listener, we forward the packet as usual
		// this is sent from out xrep socket to another relay xreq socket

		this.sendReply(metadata, packet);

	} else {
		// Else, it goes forward. The request event allows you to
		// do some routing manually if you desire to modify the data
		// path, clone the packet and send a copy somewhere else, etc.

		var sender = packet.slice(0, metadata.dataPosition - 1);
		data       = packet[metadata.dataPosition];
		returnPath = packet.slice(metadata.dataPosition + 1, -1);

		this.emit(eventType, sender, data, returnPath, meta);
	}
};


Relay.prototype.sendReply = function (metadata, packet) {
	if (metadata.flags & meta.FLAGS.REPLY_EXPECTED) {
		packet.splice(metadata.dataPosition + 1, 0, this.xreqSocket.identity);
	}

	metadata.dataPosition--;

	this.xrepSocket.send.apply(this.xrepSocket, packet);
};


Relay.prototype.sendRequest = function (metadata, packet) {
	this.xreqSocket.send.apply(this.xreqSocket, packet);
};


Relay.prototype.connect = function (addr) {
	this.xreqSocket.connect(addr);
};


Relay.prototype.disconnect = function (addr) {
	console.error('Relay disconnect is not yet implemented!');
//	this.xreqSocket.disconnect(addr);
};


Relay.prototype.bind = function (addr) {
	this.xreqSocket.bind(addr);
};

Relay.prototype.unbind = function (addr) {
	console.error('Relay unbind is not yet implemented!');
//	this.xreqSocket.unbind(addr);
};

