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
    mithril = require('../mithril'),
    logger = mithril.core.logger.context('msgServer'),
    processManager = require('../processManager');


var hostname = require('os').hostname();


var client, relay;


function deliverMessagePackageLocal(dst, msgs) {
	// If we actually have received data, we pass it to the clientHost
	// Even if null, we'll want to know, because shortpollers should be disconnected.

	// dst[0] is the address

	var clientHost = mithril.core.msgServer.getClientHost();

	if (!clientHost) {
		logger.error('mmrp tried to deliver message package, but no clientHost is set up.');
		return;
	}

	msgs = Response.unpack(msgs);

	clientHost.deliverMessages(dst[0], msgs);
}


function sendToClient(address, relay, action, msg, meta) {
	if (!client) {
		logger.error('Trying to send a message, on a non-client service.');
		return;
	}

	logger.verbose('Comm sending', msg, 'to', relay);

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


function setupClient(uri) {
	// send, receive

	logger.verbose('Setting up mmrp client');

	var Client = require('./mmrp/client').Client;
	client = new Client(uri);

	client.on('message', deliverMessagePackageLocal);

	mithril.once('shutdown', function () {
		logger.verbose('Closing mmrp client...');

		client.close();
		client = null;
	});
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


function resolveHostname(host, cb) {
	// cb: (error, ip)

	var dns = require('dns');

	// first try a dns resolve

	logger.verbose('Resolving hostname', host);

	dns.resolve(host, 'A', function (resolveError, ips) {   // for now, only IPv4 is supported and tested
		if (!resolveError && ips && ips.length > 0) {
			logger.verbose('Found IP addresses', ips, 'for hostname', host, '(using first)');

			return cb(null, ips[0]);
		}

		logger.verbose('DNS resolve failed, trying local lookup.');

		dns.lookup(host, 4, function (lookupError, ip) {   // for now, only IPv4 is supported and tested
			if (!lookupError && ip) {
				logger.verbose('Found IP address', ip, 'for hostname', host);

				return cb(null, ip);
			}

			logger.emergency('Resolving hostname', host, 'failed. Resolve error:', resolveError, '. Lookup error:', lookupError);

			cb({ resolve: resolveError, lookup: lookupError });
		});
	});
}


// setupStoreRelay is called on non-workers in order to share messages across the network

function setupStoreRelay(identity, uri, cb) {
	logger.verbose('Setting up store relay');

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

	mithril.once('shutdown', function () {
		logger.verbose('Closing mmrp relay...');

		relay.close();
		relay = null;
	});

	cb();
}


function interconnectRelays(cfgExpose, cb) {
	var error, socketDescription;

	// peer discovery and announcement

	var serviceName = mithril.core.config.get('server.mmrp.serviceDiscovery.name');

	if (!serviceName) {
		error = new Error('server.mmrp.serviceDiscovery.name not configured.');
		logger.emergency(error);
		return cb(error);
	}

	var rootPackage = mithril.rootPackage;


	// event handlers for connecting to peers

	mithril.core.serviceDiscovery.on(serviceName + '.up', function (host, port, data) {
		logger.debug.data(data).log('mdns service', serviceName, 'up at', host + ':' + port);

		var listen = data.listen;

		// if there is no socket URI to connect to, or it matches the URI that we broadcast,
		// ignore it

		if (!listen || listen === socketDescription) {
			logger.debug('Ignoring mdns service:', listen);
			return;
		}

		// if the service announcement comes from a different app or different version of this app,
		// ignore it

		var packageName = data.packageName;
		var packageVersion = data.packageVersion;

		if (packageName !== rootPackage.name || packageVersion !== rootPackage.version) {
			logger.debug('Ignoring mdns service from package:', { name: packageName, version: packageVersion }, '. Looking instead for:', rootPackage);
			return;
		}

		// make sure the URI is reachable (else zmq's connect will do an assert failure and kill the process)

		var m = listen.match(/^tcp:\/\/(.+):([0-9]+)$/);
		if (m) {
			// tcp connection, so we do a dns check

			var hostname = m[1];

			require('dns').lookup(hostname, 4, function (error, ip) {	// for now, only IPv4 is supported and tested
				if (error || !ip) {
					logger.error('DNS lookup failed for', listen);
					return;
				}

				// apparently the provided hostname can be resolved, so connect

				logger.notice.data(data).log('Relay connecting to', host + ':' + port);

				relay.connect(listen);
			});
		} else {
			// not a tcp connection, so we do not connect

			logger.warning(listen, 'does not seem to be a TCP socket, so ignored.');
		}
	});

	mithril.core.serviceDiscovery.on(serviceName + '.down', function (host, port, data) {
		// game peer down, but we do not disconnect

		logger.notice('mdns service down', serviceName, host, port, data);
	});


	// announcing our own presence on the network

	if (!cfgExpose) {
		logger.warning('No expose configuration found for service:', serviceName);
		cb();
	}

	// hostname is optional and can be read from the OS

	var host = cfgExpose.host || require('os').hostname();
	var port = cfgExpose.port;

	if (!host || !port) {
		error = new Error('Malformed mmrp exposure configuration. Not exposing service: ' + serviceName);
		logger.emergency(error);
		return cb(error);
	}

	// check if we exist in the DNS

	resolveHostname(host, function (error, ip) {
		if (error) {
			return cb(error);
		}

		// apparently the provided hostname can be resolved, so announce existence through the first found ip

		socketDescription = 'tcp://' + ip + ':' + port;

		var data = {
			listen: socketDescription,
			packageName: rootPackage.name,
			packageVersion: rootPackage.version
		};

		logger.debug.data(data).log('Announcing service', serviceName, 'on port', port);

		try {
			mithril.core.serviceDiscovery.announce(serviceName, port, data);
		} catch (e) {
			logger.emergency('Failed to announce service:', serviceName, e);
			return cb(e);
		}

		cb();
	});
}


exports.setup = function (cb) {
	logger.verbose('Setting up msgServer comm');

	// set up mmrp

	var error, identity, uri;
	var cfgBind   = mithril.core.config.get('server.mmrp.bind');
	var cfgExpose = mithril.core.config.get('server.mmrp.expose');

	if (!cfgBind) {
		logger.warning('No mmrp bindings configured: skipping all cluster communication.');
		return cb();
	}

	if (cfgBind.protocol !== 'zmq') {
		error = new Error('mmrp protocol "' + cfgBind.protocol + '" not supported.');
		logger.emergency(error);
		return cb(error);
	}

	if (cfgBind.host && cfgBind.port) {
		uri = 'tcp://' + cfgBind.host + ':' + cfgBind.port;
	} else if (cfgBind.file) {
		uri = 'ipc://' + cfgBind.file;
	} else {
		error = new Error('mmrp bindings incomplete ("host" and "port", or "file" required)');
		logger.emergency(error);
		return cb(error);
	}

	identity = hostname;

	// Set up the relay and/or client

	function relay(callback) {
		if (processManager.isWorker) {
			return callback();
		}

		setupStoreRelay(identity, uri, function (error) {
			if (error) {
				return callback(error);
			}

			interconnectRelays(cfgExpose, callback);
		});
	}

	function client(callback) {
		if (processManager.isMaster) {
			return callback();
		}

		setupClient(uri);
		callback();
	}

	relay(function (error) {
		if (error) {
			return cb(error);
		}

		client(cb);
	});
};
