// A quick and dirty message store

var LocalCache = require('localcache').LocalCache,
    msgpack = require('msgpack-0.4'),
    mithril = require('../mithril');


// Message packing / unpacking

function Message() {
	// abstract class, never instantiated
}

exports.Message = Message;


Message.pack = function (user, action, data) {
	if (data) {
		data = msgpack.pack(data);
	}

	if (typeof user === 'string') {
		user = new Buffer(user);
	}

	// format: user length, user, action, msgpack-data

	var userLength      = user.length;
	var msgBufferLength = 1 + userLength + 1 + (data ? data.length : 0);
	var msgBuffer       = new Buffer(msgBufferLength);

	msgBuffer[0] = userLength;
	user.copy(msgBuffer, 1);
	msgBuffer[1 + userLength] = action;

	if (data) {
		data.copy(msgBuffer, 1 + userLength + 1);
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


Response.addrSize = 3;


Response.pack = function (chunk) {
	if (!chunk) {
		return new Buffer(0);
	}

	// fixed identifier
	// Get the total size

	var size = 0;

	for (var id in chunk) {
		size += Response.addrSize + 3 + chunk[id].length;
	}

	var buffer = new Buffer(size);
	var counter = 0;

	for (id in chunk) {
		var currentChunk     = chunk[id];
		var currentChunkSize = currentChunk.length;

		var numId = id >>> 0;

		// MSG Id
		buffer[counter]     =  numId & 255;
		buffer[counter + 1] = (numId & 65280) >> 8;
		buffer[counter + 2] = (numId & 16711680) >> 16;

		// Data size
		buffer[counter + 3] = currentChunkSize & 255;
		buffer[counter + 4] = (currentChunkSize & 65280) >> 8;
		buffer[counter + 5] = (currentChunkSize & 16711680) >> 16;

		counter += 6;

		currentChunk.copy(buffer, counter);

		counter += currentChunkSize;
	}

	return buffer;
};


Response.unpack = function (buffer) {
	if (buffer.length === 0) {
		return null;
	}

	var ret = {};
	var pos = 0;

	while (pos < buffer.length) {
		var addr = buffer[pos] + (buffer[pos + 1] << 8) + (buffer[pos + 2] << 16);
		pos += Response.addrSize;

		var size = buffer[pos] + (buffer[pos + 1] << 8) + (buffer[pos + 2] << 16);
		pos += 3;

		ret[addr] = msgpack.unpack(buffer.slice(pos, pos + size));
		pos += size;
	}

	return ret;
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

var userTTL = 15 * 60;


Store.prototype.addrToString = function (addrName) {
	if (Buffer.isBuffer(addrName)) {
		return addrName.toString();
	}

	return addrName;
};


Store.prototype.store = function (userId, msg) {
	userId = this.addrToString(userId);

	var data = this.cache.add(userId, {}, userTTL, true);

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

	var data = this.cache.get(userId, userTTL);
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

	// returns all messages for this user

	var data = this.cache.get(userId, userTTL);
	if (data && data.messages) {
		return Response.pack(data.messages);
	}

	return Response.pack(null);
};


Store.prototype.confirm = function (userId, msgIds) {
	userId = this.addrToString(userId);

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

	// Keep info about where the user is connected

	var data = this.cache.add(userId, {}, userTTL, true);

	data.map = connArgs.slice(0);
};


Store.prototype.disconnect = function (userId, routerId) {
	userId = this.addrToString(userId);

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

	var ret;

	switch (command.action) {
	// Saving data to the store

	case ACTIONS.STORE:
		ret = this.store(addrName, command.data);

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
		ret = this.getAll(addrName);
		break;

	// We request the data in the buffer at this moment

	case ACTIONS.FORWARD:
		ret = this.getAll(addrName);
		break;

	// Data confirmation
	case ACTIONS.CONFIRM:
		try {
			this.confirm(addrName, msgpack.unpack(command.data));
		} catch (e) {
			mithril.core.logger.error('Failed to send a confirmation (malformed data?)');
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

	cb(ret, dst);
};

