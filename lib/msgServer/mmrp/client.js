var requirePeer = require('codependency').get('mage');
var zmq = requirePeer('zmq');
var util = require('util');
var EventEmitter = require('events').EventEmitter;


function Client(identity) {
	this.socket = zmq.createSocket('dealer');
	this.identity = identity;

	var that = this;

	this.socket.on('message', function () {
		// send the arguments as an array

		that.parseMessage(Array.prototype.slice.call(arguments));
	});

	// Zmq won't allow sending messages before a connection is configured. To avoid issues, we keep
	// track of this using a flag. See: https://github.com/JustinTulloss/zeromq.node/issues/271

	this.allowSend = false;
	this.badSendReported = false;
}


util.inherits(Client, EventEmitter);


module.exports = Client;


Client.prototype.connect = function (uri) {
	this.allowSend = true;
	this.badSendReported = false;
	this.socket.connect(uri);
/*
    // TODO: move this to mmrp/index.js
	var metadata = new Meta(null, null, meta.FLAGS.IGNORE);
	this.send(this.identity, null, metadata);
*/
};


Client.prototype.disconnect = function (uri) {
	this.allowSend = false;
	this.badSendReported = false;
	this.socket.disconnect(uri);
};


Client.prototype.close = function () {
	this.allowSend = false;
	this.badSendReported = false;
	this.socket.close();
};


Client.prototype.parseMessage = function (packet) {
	var metadata   = new Meta(packet[packet.length - 1]);
	var data       = packet[metadata.dataPosition];
	var sendToAddr = packet.slice(0, metadata.dataPosition);

	this.emit('message', sendToAddr, data, metadata);
};


/**
 * Sends a message to the relay it's connected to
 *
 * @param {string[]} route
 * @param {Buffer} data
 * @param {Buffer} meta
 */

Client.prototype.send = function (route, data, meta) {
	if (!this.allowSend) {
		if (!this.badSendReported) {
			this.emit('error', new Error('Dealer is not ready to send yet.'));
		}

		this.badSendReported = true;
		return;
	}

	// Package metadata

	// Create a packet that is the address, plus data and metadata to our packet (without touching
	// the original address array)

	var packet = route.concat(data, meta);

	this.socket.send(packet);
};
