// A quick and dirty message store

var LocalCache = require('localcache').LocalCache,
    mithril = require('../mithril'),
    logger = mithril.core.logger.context('msgServer');

var userTTL;

function getTTL() {
	if (!userTTL) {
		if (mithril.session) {
			userTTL = mithril.session.sessionTTL + 60;	// 1 minute safety margin

			logger.verbose('Applying a TTL of', userTTL, 'on the message store.');
		} else {
			return 10 * 60;  // default: 10 mins
		}
	}

	return userTTL;
}


// Message packing / unpacking

function Message() {
	// abstract class, never instantiated
}

exports.Message = Message;


Message.pack = function (user, action, data) {
	if (typeof user === 'string') {
		user = new Buffer(user);
	}

	// format: user length, user, action, message data

	var userLength = user.length;
	var msgBufferLength = 1 + userLength + 1 + (data ? Buffer.byteLength(data) : 0);
	var msgBuffer = new Buffer(msgBufferLength);

	msgBuffer[0] = userLength;
	user.copy(msgBuffer, 1);
	msgBuffer[1 + userLength] = action;

	if (data) {
		msgBuffer.write(data, 1 + userLength + 1);
	}

	return msgBuffer;
};


Message.unpack = function (buffer) {
	var user   = buffer.slice(1, buffer[0] + 1);
	var action = buffer[buffer[0] + 1];
	var data   = buffer.slice(buffer[0] + 2);

	return {
		user: user,
		action: action,
		data: data
	};
};


// response implementation

function Response() {
	// abstract class, never instantiated
}

exports.Response = Response;


Response.pack = function (msgs) {
	if (!msgs) {
		return new Buffer(0);
	}

	// fixed identifier
	// Get the total size

	var msgId, size = 0;

	for (msgId in msgs) {
		// msgId (3 bytes) + chunk length (3 bytes) + chunk

		size += 3 + 3 + msgs[msgId].length;
	}

	var buffer = new Buffer(size);
	var counter = 0;

	for (msgId in msgs) {
		var msg     = msgs[msgId];
		var msgSize = msg.length;

		msgId = (msgId >>> 0);

		// pack msgId

		buffer[counter]     =  msgId & 255;
		buffer[counter + 1] = (msgId & 65280) >> 8;
		buffer[counter + 2] = (msgId & 16711680) >> 16;

		counter += 3;

		// pack msg size

		buffer[counter]     = msgSize & 255;
		buffer[counter + 1] = (msgSize & 65280) >> 8;
		buffer[counter + 2] = (msgSize & 16711680) >> 16;

		counter += 3;

		// pack msg

		msg.copy(buffer, counter);

		counter += msgSize;
	}

	return buffer;
};


Response.unpack = function (buffer) {
	var bufferLen = buffer.length;

	if (bufferLen === 0) {
		return null;
	}

	var msgs = {};
	var pos = 0;
	var msgId, msgSize, msg;

	while (pos < bufferLen) {
		// msgId

		msgId = buffer[pos] + (buffer[pos + 1] << 8) + (buffer[pos + 2] << 16);
		pos += 3;

		// msgSize

		msgSize = buffer[pos] + (buffer[pos + 1] << 8) + (buffer[pos + 2] << 16);
		pos += 3;

		// msg

		try {
			msg = buffer.slice(pos, pos + msgSize);
			msgs[msgId] = msg.toString();
		} catch (e) {
			return null;
		}

		pos += msgSize;
	}

	return msgs;
};


// Action constants

var ACTIONS = exports.ACTIONS = {
	STORE: 0,
	CONNECT: 1,
	FORWARD: 2,
	CONFIRM: 3,
	DISCONNECT: 4
};


// Store implementation

function Store() {
	this.cache = new LocalCache(30);
}


exports.Store = Store;


Store.prototype.addrToString = function (addrName) {
	if (Buffer.isBuffer(addrName)) {
		return addrName.toString();
	}

	return addrName;
};


Store.prototype.store = function (userId, msg) {
	userId = this.addrToString(userId);

	var data = this.cache.add(userId, {}, getTTL(), true);

	var msgId = data.counter = 1 + (data.counter >>> 0);

	if (!data.hasOwnProperty('messages')) {
		data.messages = {};
	}

	var ret = {};
	ret[msgId] = data.messages[msgId] = msg;

	return Response.pack(ret);
};


Store.prototype.get = function (userId, msgId) {
	userId = this.addrToString(userId);

	// get one message by ID

	var data = this.cache.get(userId, getTTL());
	if (data && data.messages) {
		var msg = data.messages[msgId];

		if (msg) {
			var ret = {};
			ret[msgId] = msg;

			return Response.pack(ret);
		}
	}

	return Response.pack(null);
};


Store.prototype.getAll = function (userId) {
	userId = this.addrToString(userId);

	logger.verbose('Store getting all messages from cache for address', userId);

	// returns all messages for this user

	var data = this.cache.get(userId, getTTL());
	if (data && data.messages) {
		logger.verbose.data('messages', Object.keys(data.messages)).log('Returning messages to', userId);

		return Response.pack(data.messages);
	}

	logger.verbose('Found no messages');

	return Response.pack(null);
};


Store.prototype.confirm = function (userId, msgIds) {
	userId = this.addrToString(userId);

	logger.verbose('MsgServer Store confirming messages', msgIds, 'for address', userId);

	// confirm a bunch of messages

	var data = this.cache.get(userId);

	if (data && data.messages) {
		for (var i = 0, len = msgIds.length; i < len; i++) {
			delete data.messages[msgIds[i]];
		}
	}
};

Store.prototype.connect = function (userId, connArgs) {
	userId = this.addrToString(userId);

	logger.verbose('MsgServer Store connecting to message cache for address', userId);

	// Keep info about where the user is connected

	var data = this.cache.add(userId, {}, getTTL(), true);

	data.map = connArgs.slice(0);
};


Store.prototype.disconnect = function (userId) {
	userId = this.addrToString(userId);

	logger.verbose('MsgServer Store disconnecting from message cache:', userId);

	// Disconnect the user... remove its presence (but not the messages)

	var data = this.cache.get(userId);
	if (data) {
		delete data.map;
	}
};


// Process a request. We are expecting the args values from the previous zmq call
// Not really what we should be doing, but this is a quick fix (pop from array
// + add an attr to the function)

Store.prototype.process = function (dataBuffer, dst, cb) {
	// TODO: cb is not required... will this ever be required?

	var command = Message.unpack(dataBuffer);
	var user = command.user;
	var addrName = this.addrToString(user);

	var result;

	switch (command.action) {
	// Saving data to the store

	case ACTIONS.STORE:
		result = this.store(addrName, command.data);

		var data = this.cache.get(addrName);
		if (data && data.map) {
			dst = data.map.slice(0);
		}
		break;

	// Register this connection address to everything sent to this user from now on will be auto-forwarded to this address

	case ACTIONS.CONNECT:
		// Next argument should be shifted as well if the
		// Destination is our current master

		this.connect(addrName, dst);
		result = this.getAll(addrName);
		break;

	// We request the data in the buffer at this moment

	case ACTIONS.FORWARD:
		result = this.getAll(addrName);
		break;

	// Data confirmation
	case ACTIONS.CONFIRM:
		try {
			this.confirm(addrName, JSON.parse(command.data));
		} catch (e) {
			logger.error('Failed to send a confirmation (malformed data?)');
		}
		break;

	// We explicitly close the connection
	case ACTIONS.CLOSE:
		this.disconnect(addrName);
		break;
	}

	// append store user id to the destination address, if non-empty

	if (dst && dst.length > 0) {
		dst.push(user);
	}

	cb(result, dst);
};

