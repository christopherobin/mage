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

	// Messages coming in from here are

	if (xrepSocketAddrs) {
		for (var i = 0, len = xrepSocketAddrs.length; i < len; i++) {
			this.xrepSocket.bindSync(xrepSocketAddrs[i]);
		}
	}

	var _this = this;

	this.xrepSocket.on('message', function () {
		_this.parseRequestPacket.call(_this, Array.prototype.slice.call(arguments));
	});

	//
	// If we receive messages from this, it has to be from another Relay.
	// It either goes back or it is for us
	//

	if (xreqSocketAddrs) {
		for (i = 0, len = xreqSocketAddrs.length; i < len; i++) {
			this.xreqSocket.connect(xreqSocketAddrs[i]);
		}
	}

	this.xreqSocket.on('message', function () {
		_this.parseReplyPacket.call(_this, Array.prototype.slice.call(arguments));
	});
}


util.inherits(Relay, EventEmitter);


exports.Relay = Relay;


Relay.prototype.parseRequestPacket = function (packet) {

	console.log('parsing request packet');

	var metadata = new Meta(packet[packet.length - 1]);
	var receivedFrom = packet.shift();

	// Shuffle the injected source to the top of the return path

	if (metadata.flags & meta.FLAGS.REPLY_EXPECTED) {
		packet.splice(metadata.dataPosition + 1, 0, receivedFrom);
	}

	// We apply basic cleanup. if we have a stack of address
	// Which points to us, we remove them from the stack.
	// Eventually, this would be able to be more clever,
	// but as the stack will grow, it will be technically
	// possible to have one adress which refers to more than one
	// machine (assuming those machines are on different networks)

	while (packet[0].toString() === this.xreqSocket.identity) {
		metadata.dataPosition--;
		packet.shift();
	}

	console.log('Checking if the message is for us. Data position:', metadata.dataPosition);

	if (metadata.dataPosition === 0) {
		// If we are the destination of the data, emit an event with the request's data
		// And the address it came from

		var data = packet.shift();
		var returnPath;

		if (metadata.flags & meta.FLAGS.REPLY_EXPECTED) {
			returnPath = packet.slice(0, -1);

			console.log('Set return path');
		}

		if (metadata.flags & meta.FLAGS.AUTO_DESERIALIZE) {
			data = metadata.deserialize(data);
		}

		console.log('Emitting message');

		this.emit('message', data, returnPath, metadata);

	} else if (this.listeners('request').length === 0) {
		// If we do not have any event listener, we forward the packet as usual
		// this is sent from out xrep socket to another relay xreq socket

		this.sendReply(metadata, packet);

	} else {
		// Else, it goes forward. The request event allows you to
		// do some routing manually if you desire to modify the data
		// path, clone the packet and send a copy somewhere else, etc.

		var sender     = packet.slice(0, metadata.dataPosition - 1);
		var data       = packet[metadata.dataPosition];
		var returnPath = packet.slice(metadata.dataPosition + 1, -1);

		this.emit('request', sender, data, returnPath, meta);
	}
};


Relay.prototype.parseReplyPacket = function (packet) {

	console.log('parsing request packet');

	var metadata = new Meta(packet[packet.length - 1]);

	// We apply basic cleanup. if we have a stack of address
	// Which points to us, we remove them from the stack.
	// Eventually, this would be able to be more clever,
	// but as the stack will grow, it will be technically
	// possible to have one adress which refers to more than one
	// machine (assuming those machines are on different networks)

	while (packet[0].toString() === this.xreqSocket.identity) {
		metadata.dataPosition--;
		packet.shift();
	}


	console.log('Checking if the message is for us. Data position:', metadata.dataPosition);

	if (metadata.dataPosition === 0) {
		var data = packet.shift();
		var returnPath;

		if (metadata.flags & meta.FLAGS.REPLY_EXPECTED) {
			returnPath = packet.slice(0, -1);

			console.log('Set return path');
		}

		// We process the auto-deserialization of data if the right flag is present

		if (metadata.flags & meta.FLAGS.AUTO_DESERIALIZE) {
			data = metadata.deserialize(data);
		}

		console.log('Emitting message');

		this.emit('message', data, returnPath, metadata);

	} else if (this.listeners('reply').length === 0) {
		// If we do not have any event listener, we forward the packet as usual
		// this is sent from out xrep socket to another relay xreq socket

		console.log('Forwarding message');

		this.sendReply(metadata, packet);

	} else {
		var sender     = packet.slice(0, metadata.dataPosition - 1);
		var data       = packet[metadata.dataPosition];
		var returnPath = packet.slice(metadata.dataPosition + 1, -1);

		console.log('Emitting reply');

		this.emit('reply', sender, data, returnPath, meta);
	}
};


Relay.prototype.sendReply = function (metadata, packet) {
	console.log('Sending reply');

	if (metadata.flags & meta.FLAGS.REPLY_EXPECTED) {
		// TODO: this can be spliced

		var receiver = packet.slice(metadata.dataPosition + 1);

		receiver.unshift(this.xreqSocket.identity);

		packet = packet.slice(0, metadata.dataPosition + 1).concat(receiver);
	}

	metadata.dataPosition--;

	this.xrepSocket.send.apply(this.xrepSocket, packet);
};


Relay.prototype.sendRequest = function (metadata, packet) {
	console.log('relay.sendRequest()');

	this.xreqSocket.send.apply(this.xreqSocket, packet);
};


Relay.prototype.connect = function (addr) {
	console.log('relay.connect()');

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

