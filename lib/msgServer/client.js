function MsgServer(eventManager) {
	var HttpLongPolling = require('./transports/http-longpolling/client.js').HttpLongPolling;
	var HttpShortPolling = require('./transports/http-shortpolling/client.js').HttpShortPolling;

	this.transports = {
		'http-longpolling': HttpLongPolling,
		'http-shortpolling': HttpShortPolling
	};

	this.futurelog = {};	// queues up events that are early

	this.expectedMsgId = null;
	this.sessionKey = null;
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

// message stream

MsgServer.prototype.setupMessageStream = function (config, altSessionKey) {
	var sessionChange = false;

	var sessionKey = this.sessionKey;
	var stream = this.stream;

	if (altSessionKey) {
		// sessionKey change or initialization

		if (altSessionKey !== sessionKey) {
			sessionChange = true;
			sessionKey = altSessionKey;
		}
	}

	// nothing to do if:
	// - there is no session key
	// - there is no session change, and the stream is already running

	if (!sessionKey || (!sessionChange && stream && stream.isRunning)) {
		return;
	}

	var that = this;

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

	var params = { sessionKey: sessionKey };
	var futurelog = this.futurelog;
	var expectedMsgId = this.expectedMsgId;

	function onMessages(messages) {
		// merge messages with futurelog

		for (var msgId in messages) {
			futurelog[msgId] = messages[msgId];
		}

		if (expectedMsgId === null) {
			// first event emission, so we look for the lowest msgId and start there (should be "1")

			for (msgId in futurelog) {
				msgId = msgId >>> 0;

				if (expectedMsgId === null || msgId < expectedMsgId) {
					expectedMsgId = msgId;
				}
			}

			if (expectedMsgId === null) {
				return;
			}
		}

		// emit events

		var eventpack;

		while ((eventpack = futurelog[expectedMsgId])) {
			delete futurelog[expectedMsgId];
			expectedMsgId += 1;

			that.eventManager.emitEvents(eventpack);
		}
	}

	stream.setup(config.url, params, null, onMessages);
	stream.start();
};

module.exports = MsgServer;
