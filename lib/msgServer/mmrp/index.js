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
	if (uri) {
		assert.strictEqual(typeof uri, 'string');
	}

	assert(Array.isArray(route));
	assert(route.length > 0);

	this.uri = uri;
	this.route = route.map(String);
	this.identity = this.route[this.route.length - 1];
}

RelayConnection.prototype.setRoute = function (route) {
	this.route = route.map(String);
};


function ClientConnection(route) {
	assert(Array.isArray(route));
	assert(route.length > 0);

	this.route = route.map(String);
	this.identity = this.route[this.route.length - 1];
}


/**
 * Instantiates an MmrpNode that represents a client, relay or both in a bigger MMRP network.
 *
 * @param {string} role
 * @param {Object} cfg
 * @param {string} clusterId
 * @constructor
 */

function MmrpNode(role, cfg, clusterId) {
	EventEmitter.call(this);

	this.isRelay = (role === 'relay' || role === 'both');
	this.isClient = (role === 'client' || role === 'both');

	assert(this.isRelay || this.isClient, 'MmrpNode must be relay, client or both');
	assert(clusterId);

	// keeping track of who we're connected to

	this.relays = {};   // my peers, master-relay or both { identity: RelayConnection }
	this.clients = {};  // my clients { identity: ClientConnection }

	this.clusterId = clusterId;

	// dealer

	this.identity = this.isRelay ?
		this.clusterId :
		createDealerIdentity(this.clusterId);

	this.dealer = createDealer(this.identity);

	assert.equal(this.identity, this.dealer.getsockopt(zmq.ZMQ_IDENTITY));

	// router

	this.routerPort = null;
	this.router = null;

	if (this.isRelay) {
		this.router = createRouter(cfg);
		var routerUri = this.router.getsockopt(zmq.ZMQ_LAST_ENDPOINT);
		if (routerUri) {
			this.routerPort = parseInt(routerUri.substr(routerUri.lastIndexOf(':') + 1), 10);
		}
	}

	// mmrp socket event handling

	this._setupSocketEventHandling();

	// mmrp internal message handling

	this.on('delivery.mmrp.handshake', this._handleHandshake);
}

util.inherits(MmrpNode, EventEmitter);

exports.MmrpNode = MmrpNode;


/**
 * Connects the dealer to a particular URI (if not already connected) and sends it a handshake.
 *
 * @param {string} uri
 * @param {string} clusterId
 * @param {Function} [cb]
 */

MmrpNode.prototype.connect = function (uri, clusterId, cb) {
	// we cannot connect through routers (long routes), we are establishing a direct connection

	assert.strictEqual(typeof uri, 'string');
	assert.strictEqual(typeof clusterId, 'string');

	var route = [clusterId];
	var relay = this.relays[clusterId];

	// if we're already connected to this URI, we ignore this request

	if (relay && relay.uri) {
		if (cb) {
			cb();
		}
		return;
	}

	if (relay) {
		relay.uri = uri;
	} else {
		this.relays[clusterId] = new RelayConnection(uri, route);
	}

	logger.verbose(this.clusterId, 'dealer connecting to', uri, '(cluster: ' + clusterId + ')');

	this.dealer.connect(uri);

	logger.verbose(this.clusterId, 'handshaking with relay at', route);

	this._handshake(route, cb);
};


/**
 * Disconnects the dealer from a given URI (if connected)
 *
 * @param {string} uri
 */

MmrpNode.prototype.disconnect = function (uri) {
	var clusterIds = Object.keys(this.relays);
	for (var i = 0; i < clusterIds.length; i += 1) {
		var clusterId = clusterIds[i];
		var conn = this.relays[clusterId];

		if (conn.uri === uri) {
			delete this.relays[clusterId];

			logger.verbose(this.clusterId, 'dealer disconnecting from', uri, '(cluster: ' + clusterId + ')');

			this.dealer.disconnect(uri);
			return;
		}
	}
};


/**
 * Announce a relay as available. It should be connected to if appropriate.
 *
 * @param {string} uri
 * @param {string} clusterId
 */

MmrpNode.prototype.relayUp = function (uri, clusterId, cb) {
	// relays ignore self

	if (this.isRelay && clusterId === this.clusterId) {
		logger.verbose(this.clusterId, 'own router was announced as up (ignoring).');
		if (cb) {
			cb();
		}
		return;
	}

	// if there is no router set up, we are strictly a worker and connect only to our master router

	if (!this.isRelay) {
		if (this.isClient && clusterId === this.clusterId) {
			logger.verbose(this.clusterId, 'client connecting to own relay announced at', uri, '(cluster: ' + clusterId + ')');

			this.connect(uri, clusterId, cb);
			return;
		}

		logger.verbose(
			this.clusterId, 'ignoring relay announced at', uri, '(cluster: ' + clusterId + ')',
			'because we are not a relay'
		);

		if (cb) {
			cb();
		}
		return;
	}

	logger.verbose(this.clusterId, 'attempting to connect to', uri);

	this.connect(uri, clusterId, cb);
};


/**
 * Announce a relay as no longer available. It will disconnect from this relay if connected.
 *
 * @param {string} uri
 */

MmrpNode.prototype.relayDown = function (uri) {
	logger.verbose(this.clusterId, 'attempting to disconnect from', uri);

	this.disconnect(uri);
};


/**
 * Sends an envelope to a given socket, with the ability to retry on failure.
 *
 * @param {zmq.Socket} socket
 * @param {Envelope} envelope
 * @param {number} [attempts]
 * @param {Function} [cb]
 */

MmrpNode.prototype.sendOnSocket = function (socket, envelope, attempts, cb) {
	var that = this;

	var sockName = socket === that.router ? 'router' : 'dealer';
	var route = envelope.route.map(String);
	var args = envelope.toArgs();
	var bytes = 0;

	logger.verbose(this.clusterId, 'sending', envelope.type, 'envelope to', route, 'through', sockName);

	envelope = null;  // help GC a bit

	for (var i = 0; i < args.length; i += 1) {
		bytes += args[i].length;
	}

	var currentAttempt = 0;

	attempts = attempts || 1;

	function send() {
		currentAttempt += 1;

		socket.send(args, null, function (error) {
			if (!error) {
				if (cb) {
					cb.call(that);
				}
				return;
			}

			if (currentAttempt === attempts) {
				logger.debug.data({
					relays: that.relays,
					clients: that.clients,
					route: route,
					attempts: attempts
				}).log('Error sending message through ' + sockName + ':', error);

				if (cb) {
					cb.call(that, error);
				}
				return;
			}

			if (currentAttempt === 1) {
				logger.debug('Failed to send envelope, trying up to', attempts, 'times', error);
			}

			setTimeout(send, SEND_RETRY_INTERVAL);
		});
	}

	send();

	return bytes;
};


/**
 * Sends a message along a route of identities
 *
 * @param {Envelope} envelope
 * @param {number} [attempts]   Number of times to try resending of the route does not currently exist
 * @return {number}             Number of bytes sent
 */

MmrpNode.prototype.send = function (envelope, attempts, cb) {
	if (!cb) {
		cb = function () {};
	}

	// if sent to self, emit it and send it further if required

	if (!envelope.routeRemains() || envelope.consumeRoute(this.identity)) {
		this._onMessageToSelf(envelope, cb);
		return 0;
	}

	if (this.isRelay) {
		// If we're a relay, we always send through our router

		if (!this.router) {
			logger.warning('Cannot send envelope: router already closed');
			cb(new Error('Router is closed'));
			return 0;
		}

		if (envelope.isFlagged('TRACK_ROUTE')) {
			// the router will send to a dealer which will not reveal our address, so we add it ourselves

			envelope.injectSender(this.identity);
		}

		// check if we're being asked to broadcast on behalf of the client

		if (envelope.consumeRoute('*')) {
			this.broadcast(envelope);
			cb();
			return 0;
		}

		// this will throw if the dealer on the other end has not yet connected

		return this.sendOnSocket(this.router, envelope, attempts, cb);
	}

	// Sending through the dealer should *only* happen in cluster mode (when we're not a
	// client AND a relay in a single process) and the dealer is only connected to a single router.
	// Dealers are round-robin, and we want to route through our routers.

	if (!this.dealer) {
		logger.warning('Cannot send envelope: dealer already closed');
		cb(new Error('Dealer is closed'));
		return 0;
	}

	var connectionCount = Object.keys(this.relays).length;

	if (connectionCount === 0) {
		// drop the message

		logger.warning(this.clusterId, 'dealer is not yet connected to its relay (dropping message)');
		cb(new Error('Dealer is not yet connected'));
		return 0;
	}

	assert.strictEqual(connectionCount, 1, 'Client dealer is not allowed to be connected to multiple routers');

	return this.sendOnSocket(this.dealer, envelope, attempts, cb);
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
		that._emitDelivery(envelope);
	});

	var routes = this._getBroadcastTargets(envelope.returnRoute, routingStyle);

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


/**
 * Closes all sockets on this node and removes all event listeners as we won't be emitting anymore.
 */

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


MmrpNode.prototype._setupSocketEventHandling = function () {
	var that = this;

	this.dealer.on('message', function onDealerMessage() {
		that._onDealerMessage(slice.call(arguments));
	});

	this.dealer.on('error', function onDealerError(error) {
		logger.error('Unhandled dealer error:', error);
	});

	if (this.router) {
		this.router.on('message', function onRouterMessage(senderIdentity) {
			that._onRouterMessage(slice.call(arguments, 1), senderIdentity);
		});

		this.router.on('error', function onRouterError(error) {
			logger.error.data({ relays: that.relays, clients: that.clients }).log('Unhandled router error:', error);
		});
	}
};


MmrpNode.prototype._handleHandshake = function (envelope) {
	var message;

	try {
		message = JSON.parse(envelope.messages[0]);
	} catch (parseError) {
		logger.alert('Failed to parse handshake message:', envelope.messages[0]);
		return;
	}

	logger.debug(this.clusterId, 'received handshake from', envelope.returnRoute);

	// all other relays are welcome

	if (message.isRelay) {
		if (message.clusterId === this.clusterId) {
			logger.verbose(this.clusterId, 'relay ignoring own handshake');
		} else {
			var relay = this.relays[message.identity];

			if (relay) {
				// Make sure the returnRoute is used as the route from now on, as we may have
				// jumped through hops. The returnRoute is always more reliable than the route we
				// started with when we called connect() and sent our own handshake.

				relay.setRoute(envelope.returnRoute);
			} else {
				// register the relay, even though we can't connect to it yet

				this.relays[message.identity] = new RelayConnection(null, envelope.returnRoute);
			}
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


MmrpNode.prototype._handshake = function (route, cb) {
	var message = JSON.stringify({
		clusterId: this.clusterId,
		identity: this.identity,
		isRelay: this.isRelay,
		isClient: this.isClient
	});

	var retries = 100;

	this.send(new Envelope('mmrp.handshake', message, route, null, 'TRACK_ROUTE'), retries, cb);
};


/**
 * emits type "foo:bar" as "delivery:foo:bar", "delivery:foo" and "delivery"
 *
 * @param {Envelope} envelope
 */
MmrpNode.prototype._emitDelivery = function (envelope) {
	var eventPath = ('delivery.' + envelope.type).split('.');
	var eventName;

	while (eventPath.length > 0) {
		eventName = eventPath.join('.');

		logger.verbose('Emitting', eventName);

		this.emit(eventName, envelope);
		eventPath.pop();
	}
};


MmrpNode.prototype._onDealerMessage = function (args) {
	logger.verbose(this.clusterId, 'dealer received message');

	var envelope = Envelope.fromArgs(args);

	envelope.consumeRoute(this.identity);

	if (!this._handleBroadcastRequest(envelope)) {
		this._emitDelivery(envelope);

		if (envelope.routeRemains()) {
			this.send(envelope);
		}
	}
};


MmrpNode.prototype._onRouterMessage = function (args, senderIdentity) {
	logger.verbose(this.clusterId, 'router received message');

	var envelope = Envelope.fromArgs(args, senderIdentity);

	envelope.consumeRoute(this.identity);

	if (!this._handleBroadcastRequest(envelope)) {
		this._emitDelivery(envelope);

		if (envelope.routeRemains()) {
			this.send(envelope);
		}
	}
};


MmrpNode.prototype._onMessageToSelf = function (envelope, cb) {
	logger.verbose(this.clusterId, 'received message destined for itself');

	if (!this._handleBroadcastRequest(envelope)) {
		this._emitDelivery(envelope);

		if (envelope.routeRemains()) {
			this.send(envelope, null, cb);
		} else {
			cb();
		}
	} else {
		cb();
	}
};


/**
 * Returns an array of routes that should be broadcast to
 *
 * @param {Array}   returnRoute
 * @param {string}  routingStyle  "*" (to all relays and clients), "*:c" (to all clients), "*:r" (to all peer relays)
 * @returns {Array} all routes
 */

MmrpNode.prototype._getBroadcastTargets = function (returnRoute, routingStyle) {
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


MmrpNode.prototype._handleBroadcastRequest = function (envelope) {
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
