var requirePeer = require('codependency').get('mage');
var zmq = requirePeer('zmq');
var util = require('util');
var meta = require('./meta');
var Meta = meta.Meta;
var EventEmitter = require('events').EventEmitter;


exports.zmqVersion = zmq.version;


function Relay(identity) {
	this.router = zmq.createSocket('router');
	this.dealer = zmq.createSocket('dealer');
	this.dealer.identity = identity;
	this.identity = identity;
	this.endpoints = {}; // a lookup map for endpoints we have connected to

	// Zmq won't allow sending messages before a connection is configured. To avoid issues, we keep
	// track of this using a flag. See: https://github.com/JustinTulloss/zeromq.node/issues/271

	this.allowSend = false;
	this.badSendReported = false;

	var that = this;

	this.router.on('message', function (receivedFrom) {
		var packet = Array.prototype.slice.call(arguments, 1);

		var metadata = new Meta(packet[packet.length - 1]);

		// Shuffle the injected source to the top of the return path

		if (metadata.flags & meta.FLAGS.REPLY_EXPECTED) {
			packet.splice(metadata.dataPosition + 1, 0, receivedFrom);
		}

		that.handlePacket(metadata, packet, 'request');
	});


	this.dealer.on('message', function () {
		var packet = Array.prototype.slice.call(arguments);

		var metadata = new Meta(packet[packet.length - 1]);

		that.handlePacket(metadata, packet, 'reply');
	});
}


util.inherits(Relay, EventEmitter);


exports.Relay = Relay;


Relay.prototype.close = function () {
	this.allowSend = false;
	this.badSendReported = false;
	this.dealer.close();
	this.router.close();
};


Relay.prototype.handlePacket = function (metadata, packet, eventType) {
	var data, returnPath;

	// We apply basic cleanup. if we have a stack of addresses
	// which point to us, we remove them from the stack.
	// Eventually, this would be able to be more clever,
	// but as the stack will grow, it will be technically
	// possible to have one address which refers to more than one
	// machine (assuming those machines are on different networks).

	while (packet[0].toString() === this.identity) {
		metadata.dataPosition--;
		packet.shift();
	}

	var dataPosition = metadata.dataPosition;

	if (dataPosition === 0) {
		// If we are the destination of the data, emit an event with the request's data and
		// the address it came from.

		data = packet[0];

		if (metadata.flags & meta.FLAGS.REPLY_EXPECTED) {
			returnPath = packet.slice(1, -1);
		}

		if (metadata.flags & meta.FLAGS.AUTO_DESERIALIZE) {
			data = metadata.deserialize(data);
		}

		this.emit('message', data, returnPath, metadata);

	} else if (this.listeners(eventType).length === 0) {
		// If we do not have any event listener, we forward the packet as usual.
		// This is sent from our router socket to another relay dealer socket.

		this.sendReply(metadata, packet);

	} else {
		// Else, it goes forward. The request event allows you to
		// do some routing manually if you desire to modify the data
		// path, clone the packet and send a copy somewhere else, etc.
		// NOTE: currently, mage does not use this

		var sender = packet.slice(0, dataPosition - 1);
		data       = packet[dataPosition];
		returnPath = packet.slice(dataPosition + 1, -1);

		this.emit(eventType, sender, data, returnPath, meta);
	}
};


Relay.prototype.sendReply = function (metadata, packet) {
	if (!this.allowSend) {
		if (!this.badSendReported) {
			this.emit('error', new Error('Router is not ready to send yet.'));
		}

		this.badSendReported = true;
		return;
	}

	if (metadata.flags & meta.FLAGS.REPLY_EXPECTED) {
		packet.splice(metadata.dataPosition + 1, 0, this.dealer.identity);
	}

	metadata.dataPosition--;

	this.router.send(packet);
};


Relay.prototype.connect = function (addr) {
	if (this.endpoints[addr]) {
		// already connected, skipping the reconnect
		return;
	}

	this.allowSend = true;
	this.badSendReported = false;
	this.dealer.connect(addr);
	this.endpoints[addr] = true;
};


Relay.prototype.disconnect = function (addr) {
	this.dealer.disconnect(addr);
	delete this.endpoints[addr];

	if (Object.keys(this.endpoints).length === 0) {
		this.allowSend = false;
		this.badSendReported = false;
	}
};


Relay.prototype.bind = function (addr) {
	this.router.bindSync(addr);
};

Relay.prototype.unbind = function (addr) {
	console.error('Relay unbind is not yet implemented!', addr);
//	this.router.unbind(addr);
};
