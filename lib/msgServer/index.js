/*
 * The Message Server takes care of taking messages from A to B, and uses the following subsystems
 * to achieve that:
 *
 * - Service Discovery (to connect the dots across the network)
 * - MMRP (the messaging protocol over ZMQ)
 * - Store (where messages are kept around until delivered)
 * - Message Stream (which streams the messages to the client)
 */

// - handles message emitting (if it's run as non-master)
// - handles message delivery (if it's run as non-master)
// - handles message storage (if it's run as non-worker)
// - handles message relays (if it's run as non-worker)

var mmrp = require('./mmrp');
var MmrpNode = mmrp.MmrpNode;
var Envelope = mmrp.Envelope;
var Store = require('./store').Store;
var msgStream = require('./msgStream');

var assert = require('assert');
var processManager = require('../processManager');
var serviceDiscovery = require('../serviceDiscovery');
var mage = require('../mage');
var logger = mage.core.logger.context('msgServer');

var clusterId = require('os').hostname();
var store;
var mmrpNode;


exports.listPeerDependencies = function () {
	return {
		'MMRP ZeroMQ transport': ['zmq']
	};
};

// MMRP configuration

var cfgBind = mage.core.config.get(['server', 'mmrp', 'bind']);
var cfgNetwork = mage.core.config.get(['server', 'mmrp', 'network']);
var cfgMsgStreamRoute = mage.core.config.get(['server', 'msgStream', 'httpRoute'], '/msgstream');


exports.getClusterId = function () {
	return clusterId;
};


function assertMsgServerIsEnabled() {
	assert(cfgBind, 'No MMRP bindings configured');
	assert(cfgMsgStreamRoute, 'The message stream path has been disabled.');
	assert(serviceDiscovery.isEnabled(), 'Service discovery has not been configured');
}

var isEnabled = true;

try {
	assertMsgServerIsEnabled();
} catch (error) {
	isEnabled = false;
}

/**
 * Returns true if MMRP is or will be set up, false otherwise.
 */

exports.isEnabled = function () {
	return isEnabled;
};


exports.getMsgStreamUrl = function (headers) {
	return mage.core.httpServer.getBaseUrl(headers) + cfgMsgStreamRoute;
};


function setupMmrp() {
	logger.debug('Setting up MMRP');

	var role = processManager.isMaster ? 'relay' : (processManager.isWorker ? 'client' : 'both');

	mmrpNode = new MmrpNode(role, cfgBind, clusterId);

	mage.once('shutdown', function () {
		mmrpNode.close();
		mmrpNode = null;
	});

	mmrpNode.on('delivery.messagepack', function (envelope) {
		if (!msgStream) {
			logger.verbose('No message stream to deliver to, passing on the messagepack');
			return;
		}

		var address = envelope.getFinalDestination();

		if (address) {
			if (msgStream.managesAddress(address)) {
				msgStream.deliver(address, envelope.messages);
				envelope.consumeRoute();
			} else {
				// maybe we could bounce the message around the network until it hits the right client
				// for now, we'll just empty the route so it doesn't travel any further

				logger.warning('Message stream does not manage address:', address);
				envelope.consumeRoute();
			}
		}
	});
}


function setupStore() {
	store = new Store();

	mage.once('shutdown', function () {
		logger.verbose('Closing store');

		if (store) {
			store.close();
			store = null;
		}
	});

	mmrpNode.on('delivery.msgServer.connect', function (envelope) {
		if (!envelope.routeRemains()) {
			store.connectAddress(envelope.returnRoute);
		}
	});

	mmrpNode.on('delivery.msgServer.disconnect', function (envelope) {
		var address = envelope.getInitialSource();

		if (store.isConnected(address)) {
			store.disconnectAddress(String(envelope.messages[0]));
		}
	});

	mmrpNode.on('delivery.msgServer.confirm', function (envelope) {
		if (!envelope.routeRemains()) {
			// this is for us

			var payload = JSON.parse(envelope.messages[0]);

			store.confirm(payload.address, payload.msgIds);
		}
	});

	mmrpNode.on('delivery.msgServer.send', function (envelope) {
		var address = envelope.getFinalDestination();

		if (store.isConnected(address)) {
			store.send(address, envelope.messages);
			envelope.consumeRoute();
		} else {
			if (envelope.route.length === 1) {
				logger.warning('Message store does not manage address:', address);
				envelope.consumeRoute();
			}
		}
	});

	mmrpNode.on('delivery.msgServer.broadcast', function (envelope) {
		store.broadcast(envelope.messages);
	});

	store.on('forward', function (messages, route) {
		var payload;

		if (messages) {
			payload = [];

			var msgIds = Object.keys(messages);
			for (var i = 0; i < msgIds.length; i += 1) {
				var msgId = msgIds[i];

				payload.push(msgId, messages[msgId]);
			}
		} else {
			payload = '';
		}

		mmrpNode.send(new Envelope('messagepack', payload, route));
	});
}


// these APIs are mostly for clients to send messages into their relay

exports.send = function (address, clusterId, message) {
	mmrpNode.send(new Envelope('msgServer.send', message, [clusterId, address]));
};

exports.broadcast = function (message) {
	mmrpNode.broadcast(new Envelope('msgServer.broadcast', message));
};

exports.confirm = function (address, clusterId, msgIds) {
	var message = JSON.stringify({
		msgIds: msgIds,
		address: address
	});

	mmrpNode.send(new Envelope('msgServer.confirm', message, [clusterId]));
};

exports.connect = function (address, clusterId) {
	clusterId = clusterId || mmrpNode.clusterId; // connect to own cluster ID

	mmrpNode.send(new Envelope('msgServer.connect', null, [clusterId], [address], 'TRACK_ROUTE'));
};

exports.disconnect = function (address, clusterId) {
	mmrpNode.send(new Envelope('msgServer.disconnect', address, [clusterId]));
};


/**
 * Connects relays to other relays (master to master across the network), and connects
 * clients to relays (worker to master)
 *
 * The rules:
 * - A relay may only talk to a relay that is the same app name and same app version.
 * - A client may only talk to a relay that is its own master process, regardless of app name and
 *   version.
 */

function setupDiscovery() {
	logger.debug('Setting up service discovery');

	var ourMetadata = {
		pid: processManager.getMasterPid(),
		game: mage.rootPackage.name,
		version: mage.rootPackage.version,
		identity: mmrpNode.clusterId
	};

	var service = serviceDiscovery.createService('mmrp', 'tcp');

	/**
	 * Returns true if the announced service is the master of this process-cluster, false otherwise.
	 *
	 * @param announced
	 * @returns {boolean}
	 */

	function isMasterRelay(announced) {
		return announced.isLocal() && (parseInt(announced.data.pid, 10) === ourMetadata.pid);
	}

	function isNameMatch(announced) {
		return announced.data.game === ourMetadata.game;
	}

	function isVersionMatch(announced) {
		return announced.data.version === ourMetadata.version;
	}

	function createUri(announced) {
		// check that we have a valid ipv4 (no ipv6 love for now)

		var ip = announced.getIp(4, cfgNetwork);

		return ip ? 'tcp://' + ip + ':' + announced.port : undefined;
	}


	service.on('error', function (error, service) {
		if (!service) {
			// No service is a problem as ignoring relies on service data being there. Handle this
			// as an alert.
			return logger.alert.data(service).log(error);
		}

		if (!service.data) {
			return logger.verbose.data(service).log('Ignoring error from incompatible source', error);
		}

		if (!isNameMatch(service)) {
			return logger.verbose.data(service).log('Ignoring error from other game', error);
		}

		if (!isVersionMatch(service)) {
			return logger.verbose.data(service).log('Ignoring error from other version', error);
		}

		logger.alert.data(service).log(error);
	});


	service.on('up', function (announced) {
		// ignore different mmrp apps

		if (!isNameMatch(announced)) {
			return;
		}

		var uri = createUri(announced);

		if (!uri) {
			logger.error.data(announced.data).log(
				'Service "mmrp" up at', announced.host + ':' + announced.port,
				'but could not resolve hostname.'
			);
			return;
		}

		// ignore versions that are not exactly the same as us

		if (!isVersionMatch(announced)) {
			logger.debug.data({
				peer: announced.data,
				us: ourMetadata
			}).log('Ignoring service-up of wrong version:', announced.host + ':' + announced.port);
			return;
		}

		// relays connect to other relays, and clients connect to their own master process

		mmrpNode.relayUp(uri, announced.data.identity, isMasterRelay(announced));
	});

	// relays should disconnect from other relays when they disappear

	service.on('down', function (announced) {
		if (!announced) {
			return logger.verbose('Unknown service went down.');
		}

		// ignore different mmrp apps

		if (!isNameMatch(announced)) {
			return;
		}

		var uri = createUri(announced);

		if (!uri) {
			logger.error.data(announced.data).log(
				'Service "mmrp" down at', announced.host + ':' + announced.port,
				'but could not resolve hostname.'
			);
			return;
		}

		// ignore versions that are not exactly the same as us

		if (!isVersionMatch(announced)) {
			logger.debug.data({
				peer: announced.data,
				us: ourMetadata
			}).log('Ignoring service-down of wrong version:', announced.host + ':' + announced.port);
			return;
		}

		mmrpNode.relayDown(uri, isMasterRelay(announced));
	});

	// start discovering!

	service.discover();

	// announce our relay

	if (mmrpNode.isRelay) {
		// extract the port

		var relayUri = mmrpNode.routerUri;
		var port = parseInt(relayUri.substr(relayUri.lastIndexOf(':') + 1), 10);

		// hostname is optional and can be read from the OS

		logger.debug('Announcing mmrp relay on port', port);

		// announce the service on the network

		service.announce(port, ourMetadata, function (error) {
			if (error) {
				logger.emergency('Failed to announce MMRP relay', error);
				mage.fatalError();
				return;
			}

			logger.notice('MMRP relay announced on port', port);
		});
	}
}


function setupMsgStream() {
	if (!mmrpNode.isClient) {
		return;
	}

	logger.verbose('Setting up HTTP message stream communication');

	msgStream.bindToHttpServer(mage.core.httpServer, cfgMsgStreamRoute);
}


exports.setup = function () {
	// check requirements

	try {
		assertMsgServerIsEnabled();
	} catch (error) {
		logger.warning('Cannot set up Message Server:', error);
		return;
	}

	setupMmrp();
	setupStore();
	setupDiscovery();
	setupMsgStream();
};
