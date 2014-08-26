// The message stream connection with the end-user is managed here

var mage = require('../../mage');
var msgServer = require('../index.js');
var logger = mage.core.logger.context('msgStream');

var HttpPollingHost = require('./transports/http-polling').HttpPollingHost;


var longpollingHeartbeatInterval = mage.core.config.get(
	['server', 'msgStream', 'transports', 'longpolling', 'heartbeat'], 60
) * 1000;


// address -> transport host management

var addressMap = {};

function addTransport(address, transport) {
	var prevTransport = addressMap[address];

	if (prevTransport) {
		prevTransport.close();
	}

	addressMap[address] = transport;

	transport.on('close', function () {
		delete addressMap[address];
	});
}

function closeTransports() {
	logger.debug('Closing all connections on the message stream');

	var addresses = Object.keys(addressMap);
	for (var i = 0, len = addresses.length; i < len; i += 1) {
		var transport = addressMap[addresses[i]];

		if (transport) {
			transport.close();
		}
	}
}

exports.managesAddress = function (address) {
	return addressMap.hasOwnProperty(address);
};

function generateSessionAddress(sessionKey) {
	return 'sess/' + sessionKey;
}


// hook up a transport host to the message store through the message server

function connectTransportToStore(clusterId, address, transport) {
	// confirm previous messages

	if (transport.getConfirmIds) {
		var ids = transport.getConfirmIds();

		if (ids) {
			msgServer.confirm(address, clusterId, ids);
		}
	}

	// connect to the store

	msgServer.connect(address, clusterId, transport.getDisconnectStyle());

	// if any new confirmations come in, we must inform the message server

	transport.on('confirm', function (ids) {
		msgServer.confirm(address, clusterId, ids);
	});
}


// deliver messages to the address

exports.deliver = function (address, msgs) {
	var transport = addressMap[address];

	if (transport) {
		logger.verbose('Delivering messages to', address);

		transport.deliver(msgs);
	} else {
		logger.warning('Could not deliver messages to', address, '(address gone)');
	}
};


function handleRequest(transport) {
	// resolve the session

	var sessionKey = transport.getSessionKey();

	var state = new mage.core.State();

	mage.session.resolve(state, sessionKey, function (error, session) {
		if (!error && !session) {
			return state.close(function (error, response) {
				// This is a hack to send events to the client even if they don't have a session.
				// We use it to unset the client's session.

				transport.deliver(['0', '[' + response.myEvents.join(',') + ']']);
				transport.close();
			});
		}

		state.close();

		if (error) {
			return transport.sendServerError();
		}

		// generate a unique address string with the session key

		var address = generateSessionAddress(sessionKey);

		// remember this transport so we can deliver messages to it later

		addTransport(address, transport);

		// connect transport to the store

		connectTransportToStore(session.clusterId, address, transport);
	});
}


function handleHttpRequest(req, res, path, query) {
	// instantiate the transport over HTTP

	var transport;

	switch (query.transport) {
	case 'longpolling':
		transport = new HttpPollingHost('longpolling', longpollingHeartbeatInterval);
		break;
	case 'shortpolling':
		transport = new HttpPollingHost('shortpolling');
		break;
	default:
		res.writeHead(400, {
			'content-type': 'text/plain; charset=UTF-8',
			pragma: 'no-cache'
		});

		if (req.method === 'HEAD') {
			res.end();
		} else {
			res.end('Invalid transport: ' + query.transport);
		}
		return;
	}

	// pass ownership of req/res over to the transport

	transport.setConnection(req, res);

	if (req.method === 'HEAD') {
		logger.verbose.data(req).log('Responding to HEAD request');

		// http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html
		return transport.respondToHead();
	}

	// we're now HTTP agnostic

	handleRequest(transport);
}


exports.bindToHttpServer = function (httpServer, route) {
	httpServer.addRoute(route, handleHttpRequest, 'simple');

	httpServer.server.on('close', closeTransports);
};
