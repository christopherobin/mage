// A quick and dirty message store

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var LocalCache = require('localcache').LocalCache;
var mage = require('../../mage');

var logger = mage.core.logger.context('store');

function getTTL() {
	var ttl;

	if (mage.session) {
		ttl = mage.session.sessionTTL + 60;	// 1 minute safety margin
	} else {
		ttl = 10 * 60;  // default: 10 mins
	}

	logger.verbose('Applying a TTL of', ttl, 'seconds on the message store.');

	return ttl;
}


function Store() {
	this.cache = new LocalCache(30);
	this.ttl = getTTL();
}

util.inherits(Store, EventEmitter);

exports.Store = Store;


Store.prototype.close = function () {
	this.cache.shutdown();
};


Store.prototype.connectAddress = function (route, disconnects) {
	assert(Array.isArray(route));
	assert(route.length > 0);
	assert(disconnects === 'never' || disconnects === 'always' || disconnects === 'ondelivery');

	var address = route[route.length - 1];

	logger.verbose('Connecting address:', address, 'of route:', route, '(disconnects: ' + disconnects + ')');

	// Keep info about where the user is connected

	var data = this.cache.add(address, {}, this.ttl, true);
	data.route = route.slice();
	data.disconnects = disconnects;

	this.forward(address);
};


Store.prototype.managesAddress = function (address) {
	return this.cache.get(address) ? true : false;
};


Store.prototype.isConnected = function (address) {
	var data = this.cache.get(address);
	if (!data) {
		return false;
	}

	return data.route ? true : false;
};


Store.prototype.disconnectAddress = function (address) {
	assert(address);

	logger.verbose('Disconnecting address:', address);

	// Disconnect the user... remove its presence (but not the messages)

	var data = this.cache.get(address);
	if (data) {
		delete data.route;
	}
};


Store.prototype.broadcast = function (messages) {
	var addresses = Object.keys(this.cache.store);

	for (var i = 0, len = addresses.length; i < len; i += 1) {
		this.send(addresses[i], messages);
	}
};


Store.prototype.send = function (address, messages) {
	assert(Array.isArray(messages), 'Messages sent must be an array');

	var count = messages.length;
	if (count === 0) {
		return;
	}

	logger.verbose('Adding', count, 'message(s) for address:', address);

	var data = this.cache.add(address, {}, this.ttl, true);

	if (!data.hasOwnProperty('messages')) {
		data.messages = {};
	}

	// store all messages and create IDs for them

	for (var j = 0; j < count; j += 1) {
		var msgId = data.counter = 1 + (data.counter >>> 0);

		data.messages[msgId] = messages[j];
	}

	if (data.route) {
		this.forward(address);
	}
};


Store.prototype.forward = function (address) {
	var data = this.cache.get(address);
	if (!data || !data.route) {
		return;
	}

	var messages = data.messages || {};

	var msgIds = Object.keys(messages);
	var len = msgIds.length;

	if (len === 0) {
		if (data.disconnects === 'always') {
			logger.verbose('Forwarding', len, 'message(s) to route:', data.route);

			this.emit('forward', [], data.route);
			this.disconnectAddress(address);
		}
		return;
	}

	var payload = [];

	for (var i = 0; i < len; i += 1) {
		var msgId = msgIds[i];

		payload.push(msgId, data.messages[msgId]);
	}

	logger.verbose('Forwarding', len, 'message(s) to route:', data.route);

	this.emit('forward', payload, data.route);

	if (data.disconnects === 'ondelivery') {
		this.disconnectAddress(address);
	}
};


Store.prototype.confirm = function (address, msgIds) {
	var len = msgIds.length;

	logger.verbose('Confirming', len, 'messages for address:', address);

	// confirm a bunch of messages

	var data = this.cache.get(address);

	if (data && data.messages) {
		for (var i = 0; i < len; i++) {
			delete data.messages[msgIds[i]];
		}
	}
};
