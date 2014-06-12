// The message stream connection with the end-user is managed here

var mage = require('../mage');
var msgServer = require('./index.js');
var comm = msgServer.comm;
var httpServer = mage.core.httpServer.getHttpServer();
var logger = mage.core.logger.context('msgServer');

var BASE_PATH = '/msgstream';

var CONTENT_TYPE_JSON = { 'content-type': 'application/json; charset=UTF-8' };
var CONTENT_TYPE_PLAIN = { 'content-type': 'text/plain; charset=UTF-8' };

var longpollingDuration = mage.core.config.get(
	['server', 'clientHost', 'transports', 'longpolling', 'heartbeat'], 60
) * 1000;


function sendHttpResponse(res, statusCode, headers, body) {
	if (!headers) {
		headers = {};
	}

	// some clients (iOS6) cache even post responses
	// aggressively disable all caching

	headers.pragma = 'no-cache';

	res.writeHead(statusCode, headers);

	if (body) {
		res.end(body);
	} else {
		res.end();
	}
}


function generateSessionAddress(sessionKey) {
	return 'sess/' + sessionKey;
}


var addressMap = {};


function Address(name, storeRelay) {
	this.name = name;
	this.storeRelay = storeRelay;
}


Address.prototype.setupConnectionTimeout = function () {
	var that = this;

	this.timeoutTimer = setTimeout(function () {
		that.timeoutTimer = null;

		that.sendHeartbeat();
	}, longpollingDuration);

	// the following would also work, but yield http return code 0 in the XMLHttpRequest:
	// res.connection.setTimeout(5000, function () {});
};


Address.prototype.sendHeartbeat = function () {
	if (this.res) {
		sendHttpResponse(this.res, 200, CONTENT_TYPE_PLAIN, 'HB');
		this.removeConnectionTimeout();
		this.res = undefined;
	}
};


Address.prototype.removeConnectionTimeout = function () {
	// if a timer existed, remove it

	if (this.timeoutTimer) {
		clearTimeout(this.timeoutTimer);
		this.timeoutTimer = null;
	}
};


Address.prototype.setConnection = function (res, transport) {
	this.removeConnectionTimeout();

	if (this.res) {
		this.res.end();
	}

	this.res = res;
	this.transport = transport;

	switch (transport) {
	case 'longpolling':
		// set up a heartbeat response for longpolling

		this.setupConnectionTimeout();

		// pull in events

		comm.connect(this.name, this.storeRelay);
		break;

	case 'shortpolling':
		// pull in events

		comm.forward(this.name, this.storeRelay);
		break;

	default:
		sendHttpResponse(res, 400, CONTENT_TYPE_PLAIN, 'Invalid transport');
		this.res = undefined;
		break;
	}
};


Address.prototype.deliver = function (msgs) {
	var response;

	// if there is still a connection, respond

	if (!this.res) {
		return;
	}

	if (msgs) {
		// build a response JSON string
		// msgs: { msgId: jsonstring, msgId: jsonstring, msgId: jsonstring }

		var props = [];

		for (var msgId in msgs) {
			props.push('"' + msgId + '":' + msgs[msgId]);
		}

		if (props.length > 0) {
			response = '{' + props.join(',') + '}';

			logger.verbose('Relaying messages', response);
		}
	}

	switch (this.transport) {
	case 'longpolling':
		// if there are no messages, we wait

		if (!response) {
			return;
		}

		sendHttpResponse(this.res, 200, CONTENT_TYPE_JSON, response);

		// MMRP was designed to have us disconnect here. That means messages would no longer be
		// streamed to this node. That's correct behavior, but because of a bug it has actually
		// *never* worked. We don't need this feature, but it may introduce a little bit of noise
		// on the network. Introducing it however may cause (at least in theory) race conditions
		// where a long polling connection switching to another process could be unregistered
		// because of the late arrival of the previous disconnect call. For that reason, at least
		// for now, we're going to disable the disconnect call.

		// comm.disconnect(this.name, this.storeRelay);
		break;

	case 'shortpolling':
		// if there are no messages, we drop the connection anyway

		if (response) {
			sendHttpResponse(this.res, 200, CONTENT_TYPE_JSON, response);
		} else {
			sendHttpResponse(this.res, 200, CONTENT_TYPE_PLAIN, '');
		}
		break;

	default:
		sendHttpResponse(this.res, 400, CONTENT_TYPE_PLAIN, 'Invalid transport.');
		break;
	}

	// cleanup

	this.res = undefined;
	delete addressMap[this.name];

	this.removeConnectionTimeout();
};


Address.prototype.close = function () {
	this.removeConnectionTimeout();
	this.res = undefined;
};


function registerOrGetAddress(name, storeRelay) {
	var address = addressMap[name];
	if (address) {
		address.storeRelay = storeRelay;
	} else {
		address = addressMap[name] = new Address(name, storeRelay);
	}

	return address;
}


function requestHandler(req, res, path, query) {
	// deal with HEAD requests

	if (req.method === 'HEAD') {
		logger.verbose.data(req).log('Responding 200 to HEAD request');

		return sendHttpResponse(res, 200);
	}

	var sessionKey = query.sessionKey;

	// resolve the session

	var state = new mage.core.State();

	mage.session.resolve(state, sessionKey, function (error, session, msg) {
		state.close();

		if (error) {
			return sendHttpResponse(res, 500);  // 500: Internal service error
		}

		if (!session) {
			logger.debug.data(req).log('Responding 401: Unknown session (probably expired)');

			return sendHttpResponse(res, 401, CONTENT_TYPE_PLAIN, msg || '');
		}

		// address resolution

		var addrName = generateSessionAddress(sessionKey);

		var address = registerOrGetAddress(addrName, session.host);

		req.on('close', function () {
			if (address) {
				address.close();
			}
		});

		// confirm previous messages

		if (query.confirmIds) {
			var confirmIds = query.confirmIds.split(',');

			comm.confirm(addrName, session.host, confirmIds);
		}

		// set the connection on the address (triggering a pull on events)

		logger.verbose('Connecting the message stream to this HTTP request');

		address.setConnection(res, query.transport);
	});
}


exports.deliverMessages = function (addrName, msgs) {
	addrName = addrName.toString('utf8');

	var address = addressMap[addrName];

	if (address) {
		logger.verbose.data('messages', msgs).log('Delivering messages to', addrName);

		address.deliver(msgs);
	} else {
		logger.warning.data('messages', msgs).log('Could not deliver messages to', addrName, '(address gone)');
	}
};


exports.setup = function () {
	httpServer.addRoute(BASE_PATH, requestHandler, true);

	httpServer.server.on('close', function () {
		logger.debug('Closing message stream (sending heartbeats)');

		for (var addrName in addressMap) {
			var address = addressMap[addrName];

			if (address) {
				address.sendHeartbeat();
			}
		}
	});
};


exports.getBaseUrl = function (headers) {
	return httpServer.getClientHostBaseUrl(headers) + BASE_PATH;
};
