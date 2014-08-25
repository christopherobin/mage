// The message stream connection with the end-user is managed here

var mage = require('../../mage');

var msgServer = require('./../index.js');
var httpServer = mage.core.httpServer;
var logger = mage.core.logger.context('msgServer');

var HttpPollingHost = require('./transports/http-polling').HttpPollingHost;

var BASE_PATH = '/msgstream';


var longpollingDuration = mage.core.config.get(
	['server', 'clientHost', 'transports', 'longpolling', 'heartbeat'], 60
) * 1000;


function generateSessionAddress(sessionKey) {
	return 'sess/' + sessionKey;
}


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


function connectTransportToStore(clusterId, address, transport) {
	// connect to the store

	msgServer.connect(address, clusterId);

	// confirm previous messages

	if (transport.getConfirmIds) {
		var ids = transport.getConfirmIds();

		if (ids) {
			msgServer.confirm(address, clusterId, ids);
		}
	}

	transport.on('confirm', function (ids) {
		msgServer.confirm(address, clusterId, ids);
	});
}


function requestHandler(req, res, path, query) {
	if (req.method === 'HEAD') {
		logger.verbose.data(req).log('Responding 200 to HEAD request');

		res.writeHead(200, {
			'content-type': 'text/plain; charset=UTF-8',
			pragma: 'no-cache'
		});
		res.end();
		return;
	}

	// instantiate the transport

	var transport;

	switch (query.transport) {
	case 'longpolling':
		transport = new HttpPollingHost('longpolling', longpollingDuration);
		transport.setConnection(req, res);
		break;
	case 'shortpolling':
		transport = new HttpPollingHost('shortpolling');
		transport.setConnection(req, res);
		break;
	default:
		res.writeHead(400, {
			'content-type': 'text/plain; charset=UTF-8',
			pragma: 'no-cache'
		});

		res.end('Invalid transport: ' + query.transport);
		return;
	}

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

		// extract clusterId from the session, this is where its message store is

		var clusterId = session.host;

		// generate a unique address string with the session key

		var address = generateSessionAddress(sessionKey);

		// remember this transport so we can deliver messages to it later

		addTransport(address, transport);

		// connect transport to the store

		connectTransportToStore(clusterId, address, transport);
	});
}


exports.deliverMessages = function (address, msgs) {
	var transport = addressMap[address];

	if (transport) {
		logger.verbose('Delivering messages to', address);

		transport.deliver(msgs);
	} else {
		logger.warning('Could not deliver messages to', address, '(address gone)');
	}
};


exports.setup = function () {
	httpServer.addRoute(BASE_PATH, requestHandler, 'simple');

	httpServer.server.on('close', function () {
		logger.debug('Closing all connections on the message stream');

		var addresses = Object.keys(addressMap);
		for (var i = 0, len = addresses.length; i < len; i += 1) {
			var transport = addressMap[addresses[i]];

			if (transport) {
				transport.close();
			}
		}
	});
};


exports.getBaseUrl = function (headers) {
	return httpServer.getBaseUrl(headers) + BASE_PATH;
};
