var requirePeer = require('codependency').get('mage');
var zmq = requirePeer('zmq');
var util = require('util');
var EventEmitter = require('events').EventEmitter;


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

	// message from a dealer (may include Client)

	this.router.on('message', function (receivedFrom) {
		that.allowSend = true;

		var packet = Array.prototype.slice.call(arguments, 1);

		that.emit('message', packet, receivedFrom);
	});


	// message from a router

	this.dealer.on('message', function () {
		var packet = Array.prototype.slice.call(arguments);

		that.emit('message', packet);
	});
}


util.inherits(Relay, EventEmitter);


module.exports = Relay;


Relay.prototype.close = function () {
	this.allowSend = false;
	this.badSendReported = false;
	this.dealer.close();
	this.router.close();
};


Relay.prototype.getEndpoint = function () {
	return this.router.getsockopt('last_endpoint');
};


/**
 * Useful if a message was received that was intended for another relay
 *
 * @param args
 */

Relay.prototype.send = function (args) {
	if (!this.allowSend) {
		if (!this.badSendReported) {
			this.emit('error', new Error('Router is not ready to send yet.'));
		}

		this.badSendReported = true;
		return;
	}

	// If we do not have any event listener, we forward the packet as usual.
	// This is sent from our router socket to another relay dealer socket.

	this.router.send(args);
};


Relay.prototype.broadcast = function (args) {
	if (!this.allowSend) {
		if (!this.badSendReported) {
			this.emit('error', new Error('Relay dealer is not ready to send yet.'));
		}

		this.badSendReported = true;
		return;
	}

	// BUG: I don't think this broadcasts to all connections
	this.dealer.send(args);
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
	// this.router.unbind(addr);
};
