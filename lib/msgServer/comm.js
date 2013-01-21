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
    processManager = require('../processManager');


var hostname = require('os').hostname();

var client, relay;


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
		logger.error('Trying to send a message, on a non-client service.');
		return;
	}

	logger.verbose('Comm sending', action, 'message', msg, 'to', address, 'on relay', relay);

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


var _serviceType;

function getServiceType() {
	if (_serviceType) {
		return _serviceType;
	}

	var serviceName = mage.core.config.get('server.mmrp.serviceDiscovery.name');

	if (!serviceName) {
		throw new Error('server.mmrp.serviceDiscovery.name not configured.');
	}

	var version = serviceName + '-v' + mage.rootPackage.version.replace(/\./g, '-');

	if (version.length > 14) {
		throw new Error('server.mmrp.serviceDiscovery.name and version tag are longer than 14 characters: ' + version + ' (' + version.length + ')');
	}

	// event handlers for connecting to peers

	_serviceType = mage.core.serviceDiscovery.createServiceType('mdns', 'mmrp', 'tcp', version);
	return _serviceType;
}


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

	var Relay = require('./mmrp/relay').Relay;

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
		} else {
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
	});

	// If auto assigned port, grab it to pass on to mdns broadcasting
	if (port === "*") {
		uri = relay.xrepSocket.getsockopt('last_endpoint');
		port = parseInt(uri.substr(uri.lastIndexOf(":") + 1));
	}

	// announce the relay on the network

	var serviceType;

	try {
		serviceType = getServiceType();
	} catch (error) {
		logger.emergency(error);
		return cb(error);
	}

	// hostname is optional and can be read from the OS

	logger.debug('Announcing mmrp relay on port', port);

	var service = serviceType.createService();

	service.setDescription('[' + process.pid + '] ' + mage.rootPackage.name);
	service.setPort(port);
	service.setData({ pid: process.pid });

	service.announce(function (error) {
		if (error) {
			logger.emergency('Failed to announce mmrp relay', error);
			return cb(error);
		}

		logger.notice('mmrp relay announced on port', port);
		cb();
	});
}


function interconnectRelays(cb) {
	// peer discovery

	var serviceType;

	try {
		serviceType = getServiceType();
	} catch (error) {
		logger.emergency(error);
		return cb(error);
	}

	serviceType.on('error', function (error) {
		logger.error(error);
	});

	serviceType.on('up', function (service) {
		// make sure the URI is reachable (else zmq's connect will do an assert failure and kill the process)

		var ip = service.getIp(4);

		if (!ip) {
			logger.error.data(service.data).log('service "mmrp" up at', service.host + ':' + service.port, 'but no useful IP:', service.ips);
			return;
		}

		// check if the service is the relay of our master process

		var isMasterRelay = service.isThisHost() && (parseInt(service.data.pid, 10) === processManager.getMasterPid());

		// apparently the provided hostname can be resolved, so connect

		var uri = 'tcp://' + ip + ':' + service.port;

		if (relay) {
			// relays connect to other relays

			if (isMasterRelay) {
				logger.debug.data(service.data).log('Relay ignoring self:', service.host, '[' + service.data.pid + ']');
			} else {
				logger.notice.data(service.data).log('Relay connecting to', uri);

				relay.connect(uri);
			}
		}

		if (client) {
			// clients connect to the relay that is on their master-process

			if (isMasterRelay) {
				logger.notice.data(service.data).log('Client connecting to', uri, 'on same host:', service.host, '[' + service.data.pid + ']');

				client.connect(uri);
			} else {
				logger.debug.data(service.data).log('Client ignoring', uri, 'of other host:', service.host);
			}
		}
	});

	cb();
}


exports.setup = function (cb) {
	logger.verbose('Setting up msgServer comm');

	// set up mmrp

	var error, identity;
	var cfgBind = mage.core.config.get('server.mmrp.bind');

	var cfgExpose = mage.core.config.get('server.mmrp.expose');
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
