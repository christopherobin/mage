var requirePeer = require('codependency').get('mage');

var assert = require('assert');
var zmq = requirePeer('zmq');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var Envelope = require('./Envelope.js');
var mage = require('../../mage');
var logger = mage.core.logger.context('mmrp');
var createDealer = require('./createDealer.js');
var createRouter = require('./createRouter.js');
var slice = Array.prototype.slice;
var hostname = require('os').hostname();

exports.zmqVersion = zmq.version;

exports.Envelope = Envelope;

var SEND_RETRY_INTERVAL = 200;

var inProcessDealerCount = {};

function createDealerIdentity(clusterId) {
	// because of unit tests, etc, using a PID for unique dealers is not enough, we also need a counter

	if (!inProcessDealerCount[clusterId]) {
		inProcessDealerCount[clusterId] = 0;
	}

	inProcessDealerCount[clusterId] += 1;

	return clusterId + ':' + process.pid + ':' + inProcessDealerCount[clusterId];
}


function RelayConnection(uri, route) {
	assert.strictEqual(typeof uri, 'string');
	assert(Array.isArray(route));
	assert(route.length > 0);

	this.uri = uri;
	this.route = route.map(String);
	this.identity = this.route[this.route.length - 1];
}

function ClientConnection(route) {
	assert(Array.isArray(route));
	assert(route.length > 0);

	this.route = route.map(String);
	this.identity = this.route[this.route.length - 1];
}


function MmrpNode(role, cfg, clusterId) {
	EventEmitter.call(this);

	this.isRelay = (role === 'relay' || role === 'both');
	this.isClient = (role === 'client' || role === 'both');

	assert(this.isRelay || this.isClient, 'MmrpNode must be relay, client or both');

	// keeping track of who we're connected to

	this.relays = {};   // my peers, master-relay or both { identity: RelayConnection }
	this.clients = {};  // my clients { identity: ClientConnection }

	this.clusterId = clusterId || hostname;

	var that = this;

	// dealer

	this.identity = this.isRelay ?
		this.clusterId :
		createDealerIdentity(this.clusterId);

	this.dealer = createDealer(this.identity);

	this.dealer.on('message', function onDealerMessage() {
		that.onDealerMessage(slice.call(arguments));
	});

	// router

	if (this.isRelay) {
		this.router = createRouter(cfg);
		this.routerUri = this.router.getsockopt(zmq.ZMQ_LAST_ENDPOINT);

		this.router.on('message', function onRouterMessage(senderIdentity) {
			that.onRouterMessage(slice.call(arguments, 1), senderIdentity);
		});
	} else {
		this.router = null;
		this.routerUri = null;
	}

	// mmrp internal message handling

	this.on('delivery.mmrp.handshake', this.handleHandshake);
}

util.inherits(MmrpNode, EventEmitter);

exports.MmrpNode = MmrpNode;


MmrpNode.prototype.handleHandshake = function (envelope) {
	var message = JSON.parse(envelope.messages[0]);

	logger.debug(this.clusterId, 'received handshake from', envelope.returnRoute);

	// all other relays are welcome

	if (message.isRelay) {
		if (message.clusterId === this.clusterId) {
			logger.verbose(this.clusterId, 'relay ignoring own handshake');
		} else {
			this.relays[message.identity] = new RelayConnection(message.routerUri, envelope.returnRoute);
		}
	}

	// only care about our own clients

	if (message.isClient) {
		if (message.clusterId === this.clusterId) {
			this.clients[message.identity] = new ClientConnection(envelope.returnRoute);
		} else {
			logger.verbose(this.clusterId, 'client ignoring handshake from other cluster');
		}
	}

	this.emit('handshake', message);
};


MmrpNode.prototype.handshake = function (route) {
	var message = JSON.stringify({
		hostname: hostname,
		clusterId: this.clusterId,
		pid: process.pid,
		identity: this.dealer.getsockopt(zmq.ZMQ_IDENTITY),
		routerUri: this.routerUri,
		isRelay: this.isRelay,
		isClient: this.isClient
	});

	var retries = 100;

	this.send(new Envelope('mmrp.handshake', message, route, null, 'TRACK_ROUTE'), retries);
};


/**
 * @param {string} uri
 * @param {string} identity
 */

MmrpNode.prototype.connect = function (uri, identity) {
	// we cannot connect through routers (long routes), we are establishing a direct connection

	assert.strictEqual(typeof uri, 'string');
	assert.strictEqual(typeof identity, 'string');

	// if we're already connected to this URI, we ignore this request

	if (this.relays[identity]) {
		return;
	}

	var route = [identity];

	this.relays[identity] = new RelayConnection(uri, route);

	logger.verbose(this.clusterId, 'dealer connecting to', uri);

	this.dealer.connect(uri);

	logger.verbose(this.clusterId, 'handshaking with relay at', route);

	this.handshake(route);
};


/**
 * emits type "foo:bar" as "delivery:foo:bar", "delivery:foo" and "delivery"
 *
 * @param {Envelope} envelope
 */
MmrpNode.prototype.emitDelivery = function (envelope) {
	var eventPath = ('delivery.' + envelope.type).split('.');
	var eventName;

	while (eventPath.length > 0) {
		eventName = eventPath.join('.');

		logger.verbose('Emitting', eventName);

		this.emit(eventName, envelope);
		eventPath.pop();
	}
};


MmrpNode.prototype.onDealerMessage = function (args) {
	logger.verbose(this.clusterId, 'dealer received message');

	var envelope = Envelope.fromArgs(args);

	envelope.consumeRoute(this.dealer.getsockopt(zmq.ZMQ_IDENTITY));

	if (!this.handleBroadcastRequest(envelope)) {
		this.emitDelivery(envelope);

		if (envelope.routeRemains()) {
			this.send(envelope);
		}
	}
};


MmrpNode.prototype.onRouterMessage = function (args, senderIdentity) {
	logger.verbose(this.clusterId, 'router received message');

	var envelope = Envelope.fromArgs(args, senderIdentity);

	envelope.consumeRoute(this.dealer.getsockopt(zmq.ZMQ_IDENTITY));

	if (!this.handleBroadcastRequest(envelope)) {
		this.emitDelivery(envelope);

		if (envelope.routeRemains()) {
			this.send(envelope);
		}
	}
};


// helper function to retry while a socket throws

function retrySend(socket, args, attempts, currentAttempt) {
	currentAttempt = currentAttempt || 0;
	currentAttempt += 1;

	function onError(error) {
		if (currentAttempt === attempts) {
			if (error.message === 'No route to host') {
				logger.error('Failed to route message to', args[0], 'after', attempts, 'attempts:', error);
			} else {
				logger.error('Failed to send message after', attempts, 'attempts:', error);
			}

			return;
		}

		if (currentAttempt === 1) {
			logger.debug('Failed to send envelope, retrying up to', attempts, 'times', error);
		}

		setTimeout(retrySend, SEND_RETRY_INTERVAL, socket, args, attempts, currentAttempt);
	}

	socket.on('error', onError);
	socket.send(args);
	socket.removeListener('error', onError);
}

/**
 * Sends a message along a route of identities
 *
 * @param {Envelope} envelope
 * @param {number} attempts   Number of times to try resending of the route does not currently exist
 */

MmrpNode.prototype.send = function (envelope, attempts) {
	attempts = attempts || 1;

	if (this.isRelay) {
		// If we're a relay, we always send through our router

		if (!this.router) {
			logger.warning('Cannot send envelope: router already closed');
			return;
		}

		if (envelope.isFlagged('TRACK_ROUTE')) {
			// the router will send to a dealer which will not reveal our address, so we add it ourselves

			// TODO: stop using getsockopt
			envelope.injectSender(this.dealer.getsockopt(zmq.ZMQ_IDENTITY));
		}

		// check if we're being asked to broadcast on behalf of the client

		if (envelope.consumeRoute('*')) {
			this.broadcast(envelope);
			return;
		}

		logger.verbose(this.clusterId, 'sending', envelope.type, 'envelope to', envelope.route, 'through router');

		// this will throw if the dealer on the other end has not yet connected

		retrySend(this.router, envelope.toArgs(), attempts, 0);
	} else {
		// Sending through the dealer should *only* happen in cluster mode (when we're not a
		// client AND a relay in a single process) and the dealer is only connected to a single router.
		// Dealers are round-robin, and we want to route through our routers.

		if (!this.dealer) {
			logger.warning('Cannot send envelope: dealer already closed');
			return;
		}

		var connectionCount = Object.keys(this.relays).length;

		if (connectionCount === 0) {
			// drop the message

			logger.warning(this.clusterId, 'dealer is not yet connected to its relay (dropping message)');
			return;
		}

		assert.strictEqual(connectionCount, 1, 'Client dealer is not allowed to be connected to multiple routers');

		logger.verbose(this.clusterId, 'sending', envelope.type, 'envelope to', envelope.route, 'through dealer');

		this.dealer.send(envelope.toArgs());
	}
};


/**
 * Returns an array of routes that should be broadcast to
 *
 * @param {Array}   returnRoute
 * @param {string}  routingStyle  "*" (to all relays and clients), "*:c" (to all clients), "*:r" (to all peer relays)
 * @returns {Array} all routes
 */

MmrpNode.prototype.getBroadcastTargets = function (returnRoute, routingStyle) {
	// we broadcast to all known relays and clients, but not to the previous sender of the message

	var conn, routes = [];
	var identities, i;
	var append;

	if (routingStyle === '*' || routingStyle === '*:r') {
		if (this.isRelay) {
			// ask peer relays to broadcast to their clients

			append = '*:c';
		} else {
			// ask parent relay to broadcast to its clients and its peer relays
			append = '*';
		}

		identities = Object.keys(this.relays);
		for (i = 0; i < identities.length; i += 1) {
			conn = this.relays[identities[i]];

			if (returnRoute.indexOf(conn.identity) === -1) {
				routes.push(conn.route.concat(append));
			}
		}
	}

	if (routingStyle === '*' || routingStyle === '*:c') {
		// ask clients to simply deliver

		identities = Object.keys(this.clients);
		for (i = 0; i < identities.length; i += 1) {
			conn = this.clients[identities[i]];

			if (returnRoute.indexOf(conn.identity) === -1) {
				routes.push(conn.route.slice());
			}
		}
	}

	return routes;
};


MmrpNode.prototype.handleBroadcastRequest = function (envelope) {
	// pure clients don't forward broadcast requests

	if (this.isClient && !this.isRelay) {
		return false;
	}

	// pure relays can be asked to send to peers and clients

	if (envelope.consumeRoute('*')) {
		// a client has asked us to broadcast across the network, so send this to our relay
		this.broadcast(envelope, '*');
		return true;
	}

	if (envelope.consumeRoute('*:r')) {
		this.broadcast(envelope, '*:r');
		return true;
	}

	if (envelope.consumeRoute('*:c')) {
		this.broadcast(envelope, '*:c');
		return true;
	}

	return false;
};


/**
 * Broadcasts an envelope across the entire mesh of relays and clients.
 *
 * PURE CLUSTER:
 *
 * The logic when broadcast() is called on a pure client:
 * - deliver locally
 * - ask its relay to deliver to all its own peers (dealer.send "*:r")
 * - ask its relay to deliver to all its own clients (dealer.send "*:c")
 * (we may optimise this by addressing it as "*:rc" relays + clients, or simply "*")
 *
 * The logic when "*..." is received by a pure relay:
 * - deliver locally
 * - if asked to deliver to "*:r", ask all peers to deliver to "*:c"
 * - if asked to deliver to "*:c", deliver to all clients (avoiding the current returnRoute)
 *
 * The logic when broadcast() is called on a pure relay (identical to reception logic by pure relay)
 * - deliver locally
 * - ask all peers to deliver to all their clients ("*:c")
 * - deliver to all its own clients (normal route to client)
 *
 * The logic when "*..." is received by a pure client:
 * - deliver locally
 *
 * SINGLE-NODE:
 *
 * The logic when broadcast() is called on a client/relay:
 *
 * - deliver locally
 * - ask all peers to deliver to all their clients ("*:c")
 *
 * The logic when "*..." is received by a client/relay: (identical to reception logic by pure relay)
 *
 * - deliver locally
 * - if asked to deliver to "*:r", ask all peers to deliver to "*:c"
 * - if asked to deliver to "*:c", do nothing as we have no clients (we *are* the client and we have delivered locally)
 *
 *
 * @param {Envelope} envelope
 * @param {string} [routingStyle]   "*" (to all relays and clients), "*:c" (to all clients), "*:r" (to all peer relays)
 */

MmrpNode.prototype.broadcast = function (envelope, routingStyle) {
	routingStyle = routingStyle || '*';

	envelope.setFlag('TRACK_ROUTE');

	var that = this;

	setImmediate(function () {
		that.emitDelivery(envelope);
	});

	var routes = this.getBroadcastTargets(envelope.returnRoute, routingStyle);

	for (var i = 0; i < routes.length; i += 1) {
		var newEnvelope = new Envelope(
			envelope.type,
			envelope.messages,
			routes[i],
			envelope.returnRoute,
			envelope.getFlags()
		);

		this.send(newEnvelope);
	}
};


MmrpNode.prototype.relayUp = function (uri, identity) {
	// ignore self

	if (uri === this.routerUri) {
		logger.verbose(this.clusterId, 'own router was announced as up (ignoring).');
		return;
	}

	// if there is no router set up, we are strictly a worker and connect only to our master router

	if (!this.isRelay) {
		if (this.isClient && identity === this.clusterId) {
			logger.verbose(this.clusterId, 'client connecting to own relay announced at', uri, 'with identity', identity);

			this.connect(uri, identity);
			return;
		}

		logger.verbose(
			this.clusterId, 'ignoring relay announced at', uri, 'with identity', identity,
			'because we are not a relay'
		);
		return;
	}

	logger.verbose(this.clusterId, 'connecting to peer-relay announced at', uri, 'with identity', identity);

	this.connect(uri, identity);
};


MmrpNode.prototype.relayDown = function (uri) {
	var identities = Object.keys(this.relays);
	for (var i = 0; i < identities.length; i += 1) {
		var identity = identities[i];
		var conn = this.relays[identity];

		if (conn.uri === uri) {
			delete this.relays[identity];

			logger.verbose(this.clusterId, 'dealer disconnecting from', uri);

			this.dealer.disconnect(uri);
			return;
		}
	}
};


MmrpNode.prototype.close = function () {
	if (this.dealer) {
		logger.verbose('Closing dealer');

		this.dealer.close();
		this.dealer = null;
	}

	if (this.router) {
		logger.verbose('Closing router');

		this.router.close();
		this.router = null;
	}

	this.removeAllListeners();
};
