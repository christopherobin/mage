var HttpPollingClient = require('./msgStream/transports/http-polling/client.js').HttpPollingClient;
var WebSocketClient = require('./msgStream/transports/websocket/client.js').WebSocketClient;


function detectBestTransport(config, force) {
	if ((!force || force === 'websocket') && WebSocketClient.test(config.websocket)) {
		return 'websocket';
	}

	if ((!force || force === 'longpolling') && HttpPollingClient.test('longpolling', config.longpolling)) {
		return 'longpolling';
	}

	if ((!force || force === 'shortpolling') && HttpPollingClient.test('shortpolling', config.shortpolling)) {
		return 'shortpolling';
	}

	return null;
}


function MsgServer(eventManager) {
	this.transports = {
		'http-polling': HttpPollingClient,
		websocket: WebSocketClient
	};

	this.futureLog = {};	// queues up events for soon or immediate emission
	this.expectedMsgId = null;
	this.stream = null;

	this.eventManager = eventManager;
}


/**
 * Creates a stream over which we can receive messages asynchronously
 *
 * @param {string} transport  A type of transport
 * @param {Object} config     Configuration to pass into the stream's constructor
 * @returns {Object}          The stream instance
 */

MsgServer.prototype.createStream = function (transport, config) {
	var stream;

	switch (transport) {
	case 'longpolling':
		stream = new HttpPollingClient('longpolling', config);
		break;
	case 'shortpolling':
		stream = new HttpPollingClient('shortpolling', config);
		break;
	case 'websocket':
		stream = new WebSocketClient(config);
		break;
	default:
		throw new Error('No transport type "' + transport + '" found.');
	}

	return stream;
};


/**
 * Queues up messages for later emission
 * @param {Object} messages
 */

MsgServer.prototype.addMessages = function (messages) {
	if (!messages) {
		return;
	}

	if (typeof messages !== 'object') {
		throw new TypeError('Messages passed must be an object');
	}

	var msgIds = Object.keys(messages);

	for (var i = 0; i < msgIds.length; i += 1) {
		var msgId = msgIds[i];
		var msgIdNum = parseInt(msgId, 10);

		// register the message into the futureLog for later emission

		this.futureLog[msgId] = messages[msgId];

		// tell the message stream it may confirm this message as delivered

		if (this.stream && this.stream.confirm) {
			this.stream.confirm(msgId);
		}

		// make sure we are expecting the lowest possible msgId first

		if (msgIdNum !== 0 && this.expectedMsgId === null || msgIdNum < this.expectedMsgId) {
			this.expectedMsgId = msgIdNum;
		}
	}
};


/**
 * Forgets about all currently registered messages. Required after a session key change.
 */

MsgServer.prototype.resetFutureLog = function () {
	this.expectedMsgId = null;
	this.futureLog = {};
};


MsgServer.prototype.emitEvents = function (msgId) {
	var messages = this.futureLog[msgId];

	delete this.futureLog[msgId];

	// Emit the events in the message pack.

	if (messages) {
		this.eventManager.emitEvents(messages);
	}
};


/**
 * Emits as many messages as can be emitted without creating gaps in the flow of msgId keys
 */

MsgServer.prototype.emitFutureLog = function () {
	// Keep emitting until we encounter a gap, or futureLog has simply gone empty

	while (this.expectedMsgId && this.futureLog.hasOwnProperty(this.expectedMsgId)) {
		// Early increment expectedMsgId, so that even if an event listener were to throw, the next
		// time we call emitFutureLog, we know that we won't be expecting an old ID.

		var msgId = this.expectedMsgId;

		this.expectedMsgId += 1;

		this.emitEvents(msgId);
	}

	// finally emit any events that don't have an ID and thus don't need confirmation and lack order

	if (this.futureLog.hasOwnProperty('0')) {
		this.emitEvents('0');
	}
};


/**
 * Kills the stream connection. Can be resumed later by calling start().
 */

MsgServer.prototype.abort = function () {
	if (this.stream) {
		this.stream.abort();
	}
};


/**
 * Starts or resumes (after abort() had been called) the stream connection.
 */

MsgServer.prototype.start = function () {
	if (!this.stream) {
		throw new Error('The message stream has not yet been set up');
	}

	this.stream.start();
};


/**
 * Configures the message stream's transport types
 *
 * @param {Object} config
 * @param {string} [forceTransport] The transport type if it is forced to be used.
 * @return {boolean}                Returns true if succeeded to set up a transport, false otherwise.
 */

MsgServer.prototype.setupMessageStream = function (config, forceTransport) {
	var that = this;

	// instantiate the event stream if needed

	if (this.stream) {
		this.stream.destroy();
		this.stream = null;
	}

	var transport = detectBestTransport(config, forceTransport);

	if (!transport) {
		return false;
	}

	this.stream = this.createStream(transport, config[transport] || {});

	this.stream.on('error', function (error) {
		console.warn('Error from message stream transport:', error);
	});

	this.stream.on('delivery', function (messages) {
		try {
			that.addMessages(messages);
			that.emitFutureLog();
		} catch (error) {
			console.error('Error during message stream event emission:', error);
		}
	});

	return true;
};


MsgServer.prototype.setSessionKey = function (sessionKey) {
	if (!this.stream) {
		throw new Error('The message stream has not yet been set up');
	}

	// Make sure any lingering messages are wiped out

	this.resetFutureLog();

	this.stream.setSessionKey(sessionKey);
};


module.exports = MsgServer;
