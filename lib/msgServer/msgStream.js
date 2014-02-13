// The message stream connection with the end-user is managed here

var mage = require('../mage');
var msgServer = require('./index.js');
var comm = msgServer.comm;
var httpServer = msgServer.getHttpServer();
var logger = mage.core.logger.context('msgServer');

var BASE_PATH = '/msgstream';

var longpollingDuration = mage.core.config.get(['server', 'clientHost', 'transports', 'longpolling', 'heartbeat'], 60) * 1000;


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
		sendHttpResponse(this.res, 200, { 'content-type': 'text/plain; charset=utf8' }, 'HB');
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
		sendHttpResponse(res, 400, { 'content-type': 'text/plain; charset=utf8' }, 'Invalid transport');
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

		sendHttpResponse(this.res, 200, { 'content-type': 'application/json; charset=utf8' }, response);

		comm.disconnect(this.name, this.storeRelay);
		break;

	case 'shortpolling':
		// if there are no messages, we drop the connection anyway

		if (response) {
			sendHttpResponse(this.res, 200, { 'content-type': 'application/json; charset=utf8' }, response);
		} else {
			sendHttpResponse(this.res, 200, { 'content-type': 'text/plain; charset=utf8' }, '');
		}
		break;

	default:
		sendHttpResponse(this.res, 400, { 'content-type': 'text/plain; charset=utf8' }, 'Invalid transport.');
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

			return sendHttpResponse(res, 401, { 'content-type': 'text/plain; charset=utf8' }, msg || '');
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
		logger.debug('Closing HTTP server (sending heartbeats)');

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