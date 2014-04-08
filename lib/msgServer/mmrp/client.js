var requirePeer = require('codependency').get('mage');
var zmq = requirePeer('zmq');
var util = require('util');
var meta = require('./meta');
var Meta = meta.Meta;
var EventEmitter = require('events').EventEmitter;


function Client() {
	this.socket = zmq.createSocket('dealer');

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


exports.Client = Client;


Client.prototype.connect = function (uri) {
	this.allowSend = true;
	this.badSendReported = false;
	this.socket.connect(uri);
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

	// We auto deserialize whenever required

	if (metadata.flags & meta.FLAGS.AUTO_DESERIALIZE) {
		data = metadata.deserialize(data);
	}

	this.emit('message', sendToAddr, data, metadata);
};


Client.prototype.send = function (addr, data, metadata) {
	if (!this.allowSend) {
		if (!this.badSendReported) {
			this.emit('error', new Error('Dealer is not ready to send yet.'));
		}

		this.badSendReported = true;
		return;
	}

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

	this.socket.send(packet);
};
