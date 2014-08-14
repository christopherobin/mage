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


function createDealerIdentity(clusterId, role) {
	var identity = ['DEALER', clusterId];

	if (role === 'client') {
		identity.push(process.pid);
	}

	return identity.join(':');
}

function createRouterIdentity(clusterId) {
	return ['ROUTER', clusterId].join(':')
}


// MMRP is used as a singleton by MAGE, but turned into a class for ease of testability.

function MMRP(role, cfg, clusterId) {
	EventEmitter.call(this);

	this.role = role;
	this.connections = {};  // { uri: { out: true, in: true, route: [] } }

	var that = this;

	clusterId = clusterId || require('os').hostname();

	this.clusterId = clusterId;
	this.dealerIdentity = createDealerIdentity(clusterId, role);
	this.routerIdentity = createRouterIdentity(clusterId);

	// dealer

	var dealerIdentity = this.clusterId;

	if (role === 'client') {
		// workers add their PID
		dealerIdentity += ':' + process.pid;
	}

	this.dealer = createDealer(this, this.dealerIdentity);
	this.dealer.on('message', function () {
		that.onDealerMessage(slice.call(arguments));
	});

	// router

	if (role === 'relay' || role === 'both') {
		this.router = createRouter(cfg, this.routerIdentity);

		this.router.on('message', function (senderIdentity) {
			that.onRouterMessage(senderIdentity, slice.call(arguments, 1));
		});
	} else {
		this.router = null;
	}
};

util.inherits(MMRP, EventEmitter);


MMRP.prototype.registerConnection = function (uri) {
	if (!this.connections[uri]) {
		this.connections[uri] = {
			in: false,
			out: false,
			route: null
		};
	}

	return this.connections[uri];
};


MMRP.prototype.onDealerMessage = function (args) {
	logger.notice('>> dealer received message');

	var envelope = Envelope.fromArgs(args);

	envelope.consumeRoute(this.dealer.identity);

	this.emit('message', envelope);
};


MMRP.prototype.handleMmrpMessage = function (envelope) {
	var message = JSON.parse(envelope.message.toString());

	if (message.action === 'identify') {
		console.log('Received identity message:', message);

		var route = envelope.returnRoute.slice();
		if (route.length === 0) {
			return;
		}

		var conn = this.registerConnection(message.uri);
		conn.in = true;
		conn.route = route;

		// connect back (if we haven't been connected already)

		this.connect(message.uri);
		this.shareIdentity(route);
	}
};


MMRP.prototype.shareIdentity = function (route) {
	// shares our router identity and URI with the router at the given route

	var message = JSON.stringify({
		action: 'identify',
		uri: this.router.getsockopt('last_endpoint')
	});

	var envelope = new Envelope('mmrp', message, route, null, ['REPLY_EXPECTED']);

	this.send(envelope);
};


MMRP.prototype.connect = function (uri) {
	var conn = this.registerConnection(uri);

	// if we're already connected to this URI, we ignore this announcement

	if (conn.out) {
		return;
	}

	logger.notice('Dealer connecting to', uri);

	this.dealer.connect(uri);

	conn.out = true;
	conn.route = [];

	if (this.router) {
		// TODO: does this work? can we route with URIs???
		this.shareIdentity([uri]);
	}
};


MMRP.prototype.onRouterMessage = function (senderIdentity, args) {
	logger.notice('>> router received message from', senderIdentity.toString());

	var envelope = Envelope.fromArgs(args);

	if (senderIdentity && envelope.isFlagged('REPLY_EXPECTED')) {
		logger.notice('Injecting sender in returnRoute', senderIdentity, envelope.returnRoute);
		envelope.injectSender(senderIdentity);
		logger.notice('Injected sender in returnRoute', senderIdentity, envelope.returnRoute);
	}

	if (envelope.type === 'mmrp') {
		this.handleMmrpMessage(envelope);
		return;
	}

	if (envelope.consumeRoute(this.dealer.identity)) {
		// our dealer was indeed consumed, so our store should take an interest
		// the route that remains will inform the store where the delivery needs to go, as the
		// the store keeps the *real* full route (including the worker's identity) with the user

		this.emit('message', envelope);
	}
	/*
	 if (envelope.routeRemains()) {
	 // TODO: this logic is most vague right now
	 // forward the envelope to a client or another relay

	 if (envelope.isFlagged('REPLY_EXPECTED')) {
	 envelope.injectSender(dealerIdentity);
	 }

	 router.send(envelope.toArgs());
	 }
	 */
};


/**
 * Sends a message along a route of identities
 *
 * @param {Envelope} envelope
 */

MMRP.prototype.send = function (envelope) {
	if (!this.dealer) {
		logger.warning('Cannot send envelope: dealer already closed');
		return;
	}

	logger.notice('Sending', envelope);
	logger.notice('Sending it as', envelope.toArgs());

	this.router.send(envelope.toArgs());
};


MMRP.prototype.broadcast = function (envelope) {
	var uris = Object.keys(this.connections);

	for (var i = 0; i < uris.length; i += 1) {
		var uri = uris[i];
		var conn = this.connections[uri];

		if (conn.route) {
			var newEnvelope = new Envelope(
				envelope.type,
				envelope.message,
				conn.route.concat(envelope.route),
				envelope.returnRoute.slice(),
				envelope.getFlags()
			);

			this.send(newEnvelope);
		}
	}
};


exports.isRouter = function () {
	return !!router;
};

exports.getRouterEndpoint = function () {
	if (!router) {
		throw new Error('Relay has not been set up');
	}

	return router.getsockopt('last_endpoint');
};

exports.getDealerIdentity = function () {
	if (!dealer) {
		throw new Error('Dealer has not been set up')
	}

	return dealer.getsockopt('identity');
};

exports.getRouterIdentity = function () {
	if (!router) {
		throw new Error('Router has not been set up')
	}

	return router.getsockopt('identity');
};


MMRP.prototype.relayUp = function (uri, isOwnMasterRelay) {
	// if there is no router set up, we are strictly a worker and connect only to our master router

	if (this.role === 'client' && !isOwnMasterRelay) {
		return;
	}

	// our role is now to connect to any router that announces itself

	this.connect(uri);
};


MMRP.prototype.relayDown = function (uri) {
	// if we're not connected to this URI, we ignore this announcement

	if (!this.connections[uri]) {
		return;
	}

	logger.notice('Dealer disconnecting from', uri);

	this.dealer.disconnect(uri);
	delete this.connections[uri];
};



MMRP.prototype.close = function () {
	if (this.dealer) {
		logger.verbose('Closing MMRP dealer');

		this.dealer.close();
		this.dealer = null;
	}

	if (this.router) {
		logger.verbose('Closing MMRP router');

		this.router.close();
		this.router = null;
	}
};
