// comm.js

// - handles message emitting (if it's run as non-master)
// - handles message delivery (if it's run as non-master)
// - handles message storage (if it's run as non-worker)
// - handles message relays (if it's run as non-worker)

var store = require('./store'),
    Response = store.Response,
    Message = store.Message,
    Store = store.Store,
    meta = require('./mmrp/meta'),
    Meta = meta.Meta,
    mage = require('../mage'),
    logger = mage.core.logger.context('msgServer'),
    processManager = require('../processManager'),
    serviceDiscovery = require('../serviceDiscovery');

// this is our mmrp service discovery object for TCP announcement
var service;

var hostname = require('os').hostname();

var client, relay, ourMetadata;


function deliverMessagePackageLocal(dst, msgs) {
	// If we actually have received data, we pass it to the clientHost
	// Even if null, we'll want to know, because shortpollers should be disconnected.

	// dst[0] is the address

	var clientHost = mage.core.msgServer.getClientHost();

	if (!clientHost) {
		logger.error('mmrp tried to deliver message package, but no clientHost is set up.');
		return;
	}

	msgs = Response.unpack(msgs);

	clientHost.deliverMessages(dst[0], msgs);
}


// TODO: shouldn't sendToClient be named sendToRelay???

function sendToClient(address, relay, action, msg, meta) {
	if (!client) {
		logger.error('Cannot send messages without mmrp configured.');
		return;
	}

	logger.verbose.data({ action: action, message: msg }).log('Comm sending to', address, 'on relay', relay);

	msg = Message.pack(address, action, msg);

	try {
		// zmq socket.send may throw exceptions
		// one seen during development was "Interrupted system call"

		client.send([relay], msg, meta);
	} catch (e) {
		logger.error('Error while sending message through mmrp client:', e);
	}
}


exports.send = function (address, relay, msg) {
	sendToClient(address, relay, store.ACTIONS.STORE, msg);
};

exports.confirm = function (address, relay, msgIds) {
	sendToClient(address, relay, store.ACTIONS.CONFIRM, JSON.stringify(msgIds));
};

exports.connect = function (address, relay) {
	logger.verbose('Connecting on address', address, 'with relay', relay);

	sendToClient(address, relay, store.ACTIONS.CONNECT, null, new Meta(null, null, meta.FLAGS.REPLY_EXPECTED));
};

exports.disconnect = function (address, relay) {
	sendToClient(address, relay, store.ACTIONS.DISCONNECT, null);
};

exports.forward = function (address, relay) {
	logger.verbose('Forwarding for address', address, 'with relay', relay);

	sendToClient(address, relay, store.ACTIONS.FORWARD, null, new Meta(null, null, meta.FLAGS.REPLY_EXPECTED));
};

function setupClient(cb) {
	if (processManager.isMaster) {
		return cb();
	}

	logger.verbose('Setting up mmrp client');

	try {
		var Client = require('./mmrp/client').Client;
		client = new Client();
	} catch (error) {
		logger.emergency(error);
		return cb(error);
	}

	client.on('message', deliverMessagePackageLocal);

	mage.once('shutdown', function () {
		logger.verbose('Closing mmrp client...');

		client.close();
		client = null;
	});

	cb();
}


// relay

function handleMessageStoreResponse(data, sendTo) {
	// if the store wants us to deliver a message, send it

	if (data && sendTo && relay) {
		var metadata = new Meta(null, null, meta.FLAGS.IS_RESPONSE_PKT);
		var packet = sendTo;

		metadata.dataPosition = packet.length;

		packet.push(data, metadata.data);  // the message (no need to serialize, because it's datatype unknown) and metadata

		relay.sendReply(metadata, packet);
	}
}


// setupStoreRelay is called on non-workers in order to share messages across the network

function setupStoreRelay(identity, host, port, cb) {
	if (processManager.isWorker) {
		return cb();
	}

	var uri = 'tcp://' + host + ':' + port;

	logger.verbose('Setting up store relay:', uri);

	var messageStore = new Store();

	// create a relay

	var relaylib = require('./mmrp/relay');
	var Relay = relaylib.Relay;

	try {
		relay = new Relay(identity, uri);
	} catch (e) {
		// failure, probably a binding failed due to a service already using the socket
		// in any case, this is fatal

		if (e.code === 'EADDRINUSE' || e.message === 'Address already in use') {
			// strange, but: sometimes e.code is set, sometimes e.message

			var cmd;
			var m = uri.match(/^[a-z]+:\/\/(.+)$/);

			if (m) {
				cmd = 'netstat -lpn |grep "' + m[1] + '"';
			} else {
				cmd = 'netstat -lp';
			}

			logger.emergency
				.details('You can check which process is using this address by running:', cmd)
				.log('Relay binding failed, because the address was already in use:', uri);
		} else if (port === '*' && e.message === 'Invalid argument') {
			// NOTE: When this error occurs, it is trickled down straight form C land and not wrapped or handled along
			// the way. This results in a non error object error, with only a e.message parameter. As such no other means
			// currently exist to detect it. This needs to be fixed within the zeromq module.

			logger.emergency
				.details('Please install zeromq 3.0.0+ for wildcard ports support (current version: ' + relaylib.zmqVersion + ').')
				.log('Relay binding failed, because wildcard ports are not supported.');
		}  else {
			logger.emergency('Failed to set up comm-relay:', e);
		}

		return cb(e);
	}

	relay.on('message', function (data, sender) {
		// this relay was the endpoint for the message

		messageStore.process(data, sender, handleMessageStoreResponse);
	});

	mage.once('shutdown', function () {
		logger.verbose('Closing mmrp relay...');

		relay.close();
		relay = null;

		messageStore.shutdown();
		messageStore = null;
	});

	// Grab last endpoint (fqdn:port), pull out port and pass on to service discovery

	if (port === '*') {
		uri = relay.xrepSocket.getsockopt('last_endpoint');
		port = parseInt(uri.substr(uri.lastIndexOf(':') + 1), 10);
	}

	logger.verbose('Relay store setup on:', uri);

	// announce the relay on the network

	// hostname is optional and can be read from the OS

	logger.debug('Announcing mmrp relay on port', port);

	// announce the service on the network
	ourMetadata = {
		pid: process.pid,
		game: mage.rootPackage.name,
		version: mage.rootPackage.version
	};

	service.announce(port, ourMetadata, function (error) {
		if (error) {
			logger.emergency('Failed to announce mmrp relay', error);
			mage.fatalError();
			return;
		}

		logger.notice('mmrp relay announced on port', port);
	});

	cb();
}


/**
 * Connects relays to other relays (master to master across the network), and connects
 * clients to relays (worker to master)
 *
 * The rules:
 * - A relay may only talk to a relay that is the same app name and same app version.
 * - A client may only talk to a relay that is its own master process, regardless of app name and
 *   version.
 *
 * @param cb
 */

function interconnectRelays(cb) {
	// master-peer and master/worker discovery

	service.on('error', function (error) {
		logger.alert(error);
	});


	function createUri(announced) {
		// check that we have a valid ipv4 (no ipv6 love for now)

		var ip = announced.getIp(4);

		return ip ? 'tcp://' + ip + ':' + announced.port : undefined;
	}

	/**
	 * Returns true if the announced service is the master of this process-cluster, false otherwise.
	 *
	 * @param announced
	 * @returns {boolean}
	 */

	function isMasterRelay(announced) {
		return announced.isLocal() && (parseInt(announced.data.pid, 10) === processManager.getMasterPid());
	}

	function isNameMatch(announced) {
		return announced.data.game === mage.rootPackage.name;
	}

	function isVersionMatch(announced) {
		return announced.data.version === mage.rootPackage.version;
	}


	service.on('up', function (announced) {
		var uri = createUri(announced);

		if (!uri) {
			logger.alert.data(announced.data).log('Service "mmrp" up at', announced.host + ':' + announced.port, 'but no useful IP:', announced.ips);
			return;
		}

		// try to create connections!

		// IF WE ARE A RELAY: we may connect to other relays of the same name and version

		if (relay) {
			// ignore different mmrp apps

			if (!isNameMatch(announced)) {
				return;
			}

			// ignore versions that are not exactly the same as us

			if (!isVersionMatch(announced)) {
				logger.debug.data({ peer: announced.data, us: ourMetadata }).log('Relay ignoring peer of wrong version:', announced.host, '[' + announced.data.pid + ']');
				return;
			}

			// relays connect to other relays

			if (isMasterRelay(announced)) {
				logger.verbose.data({ peer: announced.data, us: ourMetadata }).log('Relay ignoring self:', announced.host, '[' + announced.data.pid + ']');
			} else {
				logger.notice.data({ peer: announced.data, us: ourMetadata }).log('Relay connecting to', uri, 'on host', announced.host, '[' + announced.data.pid + ']');

				relay.connect(uri);
			}
		}

		// IF WE ARE A CLIENT: we may connect to our master relay, regardless of name and version

		if (client) {
			// clients connect to the relay that is on their master-process

			if (isMasterRelay(announced)) {
				logger.notice.data({ peer: announced.data }).log('Client connecting to its relay', uri, 'on same host:', announced.host, '[' + announced.data.pid + ']');

				client.connect(uri);
			} else {
				logger.verbose.data({ peer: announced.data }).log('Client ignoring', uri, 'on host:', announced.host);
			}
		}
	});

	// relays should disconnect from other relays when they disappear

	if (relay) {
		service.on('down', function (announced) {
			var uri = createUri(announced);

			if (!uri) {
				logger.alert.data({ peer: announced.data }).log('Service "mmrp" down at', announced.host + ':' + announced.port, 'but no useful IP:', announced.ips);
				return;
			}

			// ignore other mmrp apps, or versions that are not exactly the same as us

			if (!isNameMatch(announced) || !isVersionMatch(announced)) {
				return;
			}

			// if the announced service is us, ignore it

			if (isMasterRelay(announced)) {
				logger.debug('Detected self going down, ignoring.');
			} else {
				// try to disconnect

				try {
					logger.notice.data({ peer: announced.data, us: ourMetadata }).log('Disconnecting from relay', uri, 'on host', announced.host, '[' + announced.data.pid + ']');

					if (relay) {
						relay.disconnect(uri);
					}
				} catch (error) {
					logger.error('Tried to disconnect from', uri, 'but failed with error:', error);
				}
			}
		});
	}

	// start discovering!

	service.discover();

	cb();
}


exports.setup = function (cb) {
	logger.verbose('Setting up msgServer comm');

	// set up mmrp

	var error, identity;
	var cfgBind = mage.core.config.get(['server', 'mmrp', 'bind']);

	var cfgExpose = mage.core.config.get(['server', 'mmrp', 'expose']);
	if (cfgExpose) {
		logger.warning('server.mmrp.expose has been deprecated, please remove it from your configuration');
	}

	if (!cfgBind) {
		logger.warning('No mmrp bindings configured: skipping all cluster communication.');
		return cb();
	}

	if (cfgBind.protocol !== 'zmq') {
		error = new Error('mmrp protocol "' + cfgBind.protocol + '" not supported.');
		logger.emergency(error);
		return cb(error);
	}

	if (!cfgBind.port) {
		error = new Error('mmrp bindings incomplete ("host" and "port", or "file" required)');
		logger.emergency(error);
		return cb(error);
	}

	identity = hostname;


	// retrieve discovery service

	logger.verbose('Creating discovery service');

	try {
		service = serviceDiscovery.createService('mmrp', 'tcp');
	} catch (error) {
		logger.emergency(error);
		return cb(error);
	}

	// Set up the relay and/or client

	setupStoreRelay(identity, cfgBind.host, cfgBind.port, function (error) {
		if (error) {
			return cb(error);
		}

		setupClient(function (error) {
			if (error) {
				return cb(error);
			}

			interconnectRelays(cb);
		});
	});
};
