// A quick and dirty message store

var EventEmitter = require('events').EventEmitter;
var LocalCache = require('localcache').LocalCache;
var StoreCommand = require('./StoreCommand');
var mage = require('../../mage');

var logger = mage.core.logger.context('store');
var cache = new LocalCache(30);

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


function addrToString(addrName) {
	if (Buffer.isBuffer(addrName)) {
		return addrName.toString();
	}

	return addrName;
};


exports = module.exports = new EventEmitter();

exports.StoreCommand = StoreCommand;


exports.shutdown = function () {
	cache.shutdown();
};


function emitDelivery(userId, messages, route) {
	// TODO: serialize messages (this could also be done by msgServer or StoreCommand)

	var command = new StoreCommand(userId, 'DELIVER', messages);

	exports.emit('deliver', command, route.slice());
}


exports.connect = function (userId, route) {
	userId = addrToString(userId);

	if (userId === '*') {
		throw new Error('User ID "*" is not allowed.');
	}

	logger.verbose('Connecting to message cache for address:', userId);

	// Keep info about where the user is connected

	var data = cache.add(userId, {}, getTTL(), true);

	if (route) {
		data.route = route.slice();

		emitDelivery(userId, data.messages, route);
	} else {
		delete data.route;
	}
}


exports.disconnect = function (userId) {
	userId = addrToString(userId);

	logger.verbose('Disconnecting from message cache for address:', userId);

	// Disconnect the user... remove its presence (but not the messages)

	var data = cache.get(userId);
	if (data) {
		delete data.route;
	}
}


exports.send = function (userId, msg) {
	userId = addrToString(userId);

	if (userId === '*') {
		var userIds = Object.keys(cache.store);

		for (var i = 0; i < userIds.length; ++i) {
			exports.send(userIds[i], msg);
		}
		return;
	}

	logger.verbose('Adding message to message cache for address:', userId);

	var data = cache.add(userId, {}, getTTL(), true);

	var msgId = data.counter = 1 + (data.counter >>> 0);

	if (!data.hasOwnProperty('messages')) {
		data.messages = {};
	}

	data.messages[msgId] = msg;

	if (data.route) {
		emitDelivery(userId, data.messages, data.route);
	}
};


exports.confirm = function (userId, msgIds) {
	userId = addrToString(userId);

	var len = msgIds.length;

	logger.verbose.data('msgIds', msgIds).log('Confirming', len, 'messages for address:', userId);

	// confirm a bunch of messages

	var data = cache.get(userId);

	if (data && data.messages) {
		for (var i = 0; i < len; i++) {
			delete data.messages[msgIds[i]];
		}
	}
};
