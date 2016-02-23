var EventEmitter = require('events').EventEmitter;
var util = require('util');
var logger = require('../../../../mage').core.logger.context('msgStream', 'WebSocket');


function WebSocketHost() {
	EventEmitter.call(this);

	this.client = null;

	this.address = {
		address: null,
		type: null
	};
}

util.inherits(WebSocketHost, EventEmitter);

exports.create = function (/* cfg */) {
	return new WebSocketHost();
};


// Universal transport API:

WebSocketHost.prototype.getDisconnectStyle = function () {
	return 'never';
};


WebSocketHost.prototype.getAddressInfo = function () {
	return this.address;
};


WebSocketHost.prototype._safeSend = function (data) {
	try {
		this.client.send(data);
	} catch (sendError) {
		logger.verbose('Error sending message:', sendError);

		try {
			this.client.terminate();
		} catch (terminateError) {
			// do nothing
		}

		this._closeConnection();
	}
};


WebSocketHost.prototype.deliver = function (msgs) {
	if (!this.client) {
		logger.warning('No client to deliver to');
		return;
	}

	logger.verbose('Delivering', msgs.length, 'messages');

	// msgs: [id, content, id, content, id, content, etc...]

	// build a response JSON string
	// msgs: { msgId: jsonstring, msgId: jsonstring, msgId: jsonstring }

	if (msgs.length === 0) {
		return;
	}

	var props = [];

	for (var i = 0, len = msgs.length; i < len; i += 2) {
		var id = msgs[i];
		var msg = msgs[i + 1];

		props.push('"' + id + '":' + msg);
	}

	this._safeSend('{' + props.join(',') + '}');
};


WebSocketHost.prototype.respondBadRequest = function (reason) {
	if (!this.client) {
		logger.verbose('Cannot respond bad request (client gone)');
		return;
	}

	logger.verbose('Responding bad request:', reason);

	// https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes
	// The endpoint is terminating the connection because it received a message that violates its
	// policy. This is a generic status code, used when codes 1003 and 1009 are not suitable.

	this.client.close(1008, reason || 'Bad request');
	this._closeConnection();
};


WebSocketHost.prototype.respondServerError = function () {
	// used when we fail to confirm a session key for example

	if (!this.client) {
		logger.verbose('Cannot respond server error (client gone)');
		return;
	}

	logger.verbose('Responding server error');

	// https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes
	// The server is terminating the connection because it encountered an unexpected condition that
	// prevented it from fulfilling the request.

	this.client.close(1011, 'Server error');
	this._closeConnection();
};


WebSocketHost.prototype.close = function () {
	if (!this.client) {
		logger.verbose('Cannot close client (already gone)');
		return;
	}

	logger.verbose('Closing client');

	this.client.close();
	this._closeConnection();
};


// HTTP transport specific API:

WebSocketHost.prototype.setConnection = function (client, query) {
	logger.verbose('Connection established');

	var that = this;

	this.client = client;

	if (query.sessionKey) {
		this.address.address = query.sessionKey;
		this.address.type = 'session';
	}

	query = null;

	// "close" indicates that the underlying connection was terminated before response.end() was
	// called or able to flush.

	client.on('message', function (str) {
		if (str) {
			that.emit('confirm', str.split(','));
		}
	});

	client.on('error', function (error) {
		logger.warning(error);
	});

	client.once('close', function () {
		// client closed the connection
		logger.verbose('Client at address', that.address.address, 'disconnected');

		that._closeConnection();
	});
};


WebSocketHost.prototype._closeConnection = function () {
	if (!this.client) {
		return;
	}

	this.client = null;
	this.emit('close');
	this.emit('disconnect');
	this.removeAllListeners();
};
