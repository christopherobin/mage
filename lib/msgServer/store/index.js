// A quick and dirty message store

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var LocalCache = require('localcache').LocalCache;
var mage = require('../../mage');

var logger = mage.core.logger.context('store');

var userTTL;

function getTTL() {
	if (!userTTL) {
		if (mage.session) {
			userTTL = mage.session.sessionTTL + 60;	// 1 minute safety margin

			logger.verbose('Applying a TTL of', userTTL, 'on the message store.');
		} else {
			return 10 * 60;  // default: 10 mins
		}
	}

	return userTTL;
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


Store.prototype.connectAddress = function (route) {
	assert(Array.isArray(route));
	assert(route.length > 0);

	var address = route[route.length - 1];

	logger.verbose('Connecting to message cache for address:', address);

	// Keep info about where the user is connected

	var data = this.cache.add(address, {}, this.ttl, true);
	data.route = route.slice();

	this.emit('forward', data.messages, data.route);
};


Store.prototype.isConnected = function (address) {
	return this.cache.store.hasOwnProperty(address);
};


Store.prototype.disconnectAddress = function (address) {
	assert(address);

	logger.verbose('Disconnecting from message cache for address:', address);

	// Disconnect the user... remove its presence (but not the messages)

	var data = this.cache.get(address);
	if (data) {
		delete data.route;
	}
};


Store.prototype.send = function (address, messages) {
	if (address[0] === '*') {
		var addresses = Object.keys(this.cache.store);

		for (var i = 0; i < addresses.length; ++i) {
			this.send(addresses[i], messages);
		}
		return;
	}

	var count = messages.length;
	if (count === 0) {
		return;
	}

	logger.verbose('Adding', count, 'message(s) to message cache for address:', address);

	var data = this.cache.add(address, {}, this.ttl, true);

	if (!data.hasOwnProperty('messages')) {
		data.messages = {};
	}

	for (var j = 0; j < count; j += 1) {
		var msgId = data.counter = 1 + (data.counter >>> 0);

		data.messages[msgId] = messages[j];
	}

	if (data.route) {
		this.emit('forward', data.messages, data.route);
	}
};


Store.prototype.confirm = function (address, msgIds) {
	var len = msgIds.length;

	logger.verbose.data('msgIds', msgIds).log('Confirming', len, 'messages for address:', address);

	// confirm a bunch of messages

	var data = this.cache.get(address);

	if (data && data.messages) {
		for (var i = 0; i < len; i++) {
			delete data.messages[msgIds[i]];
		}
	}
};
