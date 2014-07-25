function MsgServer(eventManager) {
	var HttpLongPolling = require('./transports/http-longpolling/client.js').HttpLongPolling;
	var HttpShortPolling = require('./transports/http-shortpolling/client.js').HttpShortPolling;

	this.transports = {
		'http-longpolling': HttpLongPolling,
		'http-shortpolling': HttpShortPolling
	};

	this.futureLog = {};	// queues up events that are early

	this.expectedMsgId = null;
	this.stream = null;

	this.eventManager = eventManager;
}


// transport

MsgServer.prototype.createTransport = function (type, options) {
	// check transport availability

	var Transport = this.transports[type];
	if (!Transport) {
		throw new Error('No transport type "' + type + '" found.');
	}

	return new Transport(options);
};


function onMessages(msgServer, messages) {
	if (!messages) {
		return;
	}

	// merge messages with futureLog

	var futureLog = msgServer.futureLog;

	for (var msgId in messages) {
		futureLog[msgId] = messages[msgId];
	}

	if (msgServer.expectedMsgId === null) {
		// first event emission, so we look for the lowest msgId and start there (should be "1")

		for (msgId in futureLog) {
			msgId = msgId >>> 0;

			if (msgServer.expectedMsgId === null || msgId < msgServer.expectedMsgId) {
				msgServer.expectedMsgId = msgId;
			}
		}

		if (msgServer.expectedMsgId === null) {
			return;
		}
	}

	// emit events

	var eventpack;

	while ((eventpack = futureLog[msgServer.expectedMsgId])) {
		delete futureLog[msgServer.expectedMsgId];
		msgServer.expectedMsgId += 1;

		msgServer.eventManager.emitEvents(eventpack);
	}
}

MsgServer.prototype.abort = function () {
	this.stream.abort();
};

MsgServer.prototype.start = function () {
	this.stream.start();
};

// message stream

MsgServer.prototype.setupMessageStream = function (config, sessionKey) {
	var that = this;

	var stream = this.stream;

	// a transport is required for the event stream

	if (!stream) {
		this.stream = stream = this.createTransport('http-longpolling', config.httpOptions);

		stream.on('error', function (error, message) {
			if (error === 'auth') {
				// auth errors pause the event stream until reauthenticated

				stream.abort();
				that.eventManager.emitEvent('io.error.auth', { reason: 'auth', message: message });
			}
		});
	}

	stream.setup(config.url, { sessionKey: sessionKey }, null, function (messages) {
		onMessages(that, messages);
	});
};

module.exports = MsgServer;
