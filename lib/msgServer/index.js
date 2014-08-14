/*
 * The Message Server takes care of taking messages from A to B, and uses the following subsystems
 * to achieve that:
 *
 * - Service Discovery (to connect the dots across the network)
 * - MMRP (the messaging protocol)
 * - Store (where messages are kept around until delivered)
 */


// - handles message emitting (if it's run as non-master)
// - handles message delivery (if it's run as non-master)
// - handles message storage (if it's run as non-worker)
// - handles message relays (if it's run as non-worker)

var mmrp = require('./mmrp');
var store = require('./store');
var processManager = require('../processManager');
var serviceDiscovery = require('../serviceDiscovery');
var mage = require('../mage');
var logger = mage.core.logger.context('msgServer');
var msgStream;

var Envelope = mmrp.Envelope;
var StoreCommand = store.StoreCommand;


var ourMetadata = {
	pid: processManager.getMasterPid(),
	game: mage.rootPackage.name,
	version: mage.rootPackage.version
};

exports.listPeerDependencies = function () {
	return {
		'MMRP ZeroMQ transport': ['zmq']
	};
};


//exports.identity = mmrp.getDealerIdentity();  // TODO: do we need this?


// MMRP configuration

var cfgBind = mage.core.config.get(['server', 'mmrp', 'bind']);
var cfgNetwork = mage.core.config.get(['server', 'mmrp', 'network']);


/**
 * Returns true if MMRP is or will be set up, false otherwise.
 */

exports.isEnabled = function () {
	return cfgBind ? true : false;
};


exports.getMsgStreamUrl = function (headers) {
	return require('./msgStream').getBaseUrl(headers);
};


function sendClientToClient(envelope) {
	logger.verbose('Sending', envelope.message.action, 'message to', envelope.message.address, 'through route', envelope.route);

	mmrp.send(envelope);
}


/*
 * TO FIGURE OUT:
 *
 * - Can we drop the address from StoreCommand and deal with route only? We then need to be able to
 *   intercept '*' address in order to broadcast over multiple sockets.
 * - Can we make a single string like "send/broadcast/confirm/connect" part of the envelope?
 *   That would remove the need for a lot of logic and "data type" definitions. Event handlers would
 *   know how to deal with the buffers emitted. mmrp can emit the events.
 */

exports.send = function (address, relay, msg) {
	var message = new StoreCommand(address, 'SEND', msg);
	var envelope = new Envelope(message, 'StoreCommand', relay);

	sendClientToClient(envelope);
};

exports.broadcast = function (msg) {
	var message = new StoreCommand('*', 'BROADCAST', msg);
	var envelope = new Envelope(message, 'StoreCommand', mmrp.getIdentity());

	sendClientToClient(envelope);
};

exports.confirm = function (address, relay, msgIds) {
	var message = new StoreCommand(address, 'CONFIRM', JSON.stringify(msgIds));
	var envelope = new Envelope(message, 'StoreCommand', relay);

	sendClientToClient(envelope);
};

exports.connect = function (address, relay) {
	var message = new StoreCommand(address, 'CONNECT');
	var envelope = new Envelope(message, 'StoreCommand', relay, null, ['REPLY_EXPECTED']);

	sendClientToClient(envelope);
};

exports.disconnect = function (address, relay) {
	var message = new StoreCommand(address, 'DISCONNECT');
	var envelope = new Envelope(message, 'StoreCommand', relay);

	sendClientToClient(envelope);
};


// Sets up the message store and its connections with MMRP

function setupStore() {
	var storeActions = {
		CONNECT: function (envelope, command) {
			console.log('Connecting', envelope);

			store.connect(command.address, envelope.returnRoute);
		},
		DISCONNECT: function (envelope, command) {
			store.disconnect(command.address);
		},
		SEND: function (envelope, command) {
			store.send(command.address, command.message);
		},
		CONFIRM: function (envelope, command) {
			store.confirm(command.address, JSON.parse(command.message));
		}
	};

	// when the relay delivers us a message, it's for a store operation

	mmrp.on('relay.message', function (envelope) {
		var command = StoreCommand.fromBuffer(envelope.message);
		var fn = storeActions[command.action];

		if (fn) {
			fn(envelope, command);
		} else {
			logger.alert('Received an unknown store-command from the relay:', command.action);
		}
	});

	var clientActions = {
		DELIVER: function (envelope, command) {
			// Even if we received no messages, we'll want to deliver that knowledge, so that
			// shortpollers can disconnect.

			if (!msgStream) {
				logger.error('mmrp tried to deliver message package, but message stream is disabled.');
				return;
			}

			// command.address should be the userId

			msgStream.deliverMessages(command.address, command.msg);
		}
	};

	mmrp.on('client.message', function (envelope) {
		var command = StoreCommand.fromBuffer(envelope.message);
		var fn = clientActions[command.action];

		if (fn) {
			fn(envelope, command);
		} else {
			logger.alert('Received an unknown store-command from the client:', command.action);
		}
	});

	// when the store has a delivery to make, it emits an event

	store.on('deliver', function (command, route) {
		mmrp.send(new Envelope(command, route));
	});

	mage.once('shutdown', function () {
		logger.verbose('Closing store');

		if (store) {
			store.shutdown();
			store = null;
		}
	});
}


/**
 * Connects relays to other relays (master to master across the network), and connects
 * clients to relays (worker to master)
 *
 * The rules:
 * - A relay may only talk to a relay that is the same app name and same app version.
 * - A client may only talk to a relay that is its own master process, regardless of app name and
 *   version.
 */

function startDiscovery() {
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

		mmrp.relayUp(uri, isMasterRelay(announced));
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

		mmrp.relayDown(uri, isMasterRelay(announced));
	});

	// start discovering!

	service.discover();

	// announce our relay

	if (mmrp.isRelay()) {
		// extract the port

		var relayUri = mmrp.getRelayEndpoint();
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
	logger.verbose('Setting up HTTP message stream communication');

	msgStream = require('./msgStream');
	msgStream.setup();
	exports.msgStream = msgStream;
}


exports.setup = function () {
	// Message store

	setupStore();

	// MMRP

	if (!cfgBind) {
		logger.warning('No MMRP bindings configured: skipping all cluster communication.');
		return;
	}

	logger.debug('Setting up MMRP');

	mage.once('shutdown', function () {
		mmrp.close();
	});

	mmrp.setup(cfgBind);

	// Service Discovery

	logger.debug('Setting up service discovery');

	if (!serviceDiscovery.isEnabled()) {
		// no service discovery: no msgServer
		logger.warning('Service discovery has not been configured, so MMRP cannot be used.');
		mmrp.close();
		return;
	}

	startDiscovery();

	// Message stream

	setupMsgStream();
};
