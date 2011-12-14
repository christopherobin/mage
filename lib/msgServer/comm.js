// comm.js

// - handles message emitting (if it's run as non-master)
// - handles message delivery (if it's run as non-master)
// - handles message storage (if it's run as non-worker)
// - handles message relays (if it's run as non-worker)


var zmq       = require('zmq'),
    mdns      = require('node-bj'),
    store     = require('./store'),
    Response  = store.Response,
    Message   = store.Message,
    Store     = store.Store,
    meta      = require('./mmrp/meta'),
    Meta      = meta.Meta,
    mithril   = require('../mithril');


var hostname = require('os').hostname();


var client, relay, clientHost;


function deliverMessagePackageLocal(dst, msgs, metadata) {
	// If we actually have received data, we pass it to the clientHost
	// Even if null, we'll want to know, because shortpollers should be disconnected.

	// dst[0] is the address

	if (clientHost) {
		clientHost.deliverMessages(dst[0], Response.unpack(msgs));
	}
}


function sendToClient(address, relay, action, msg, meta) {
	if (!client) {
		mithril.core.logger.error('Trying to send a message, on a non-client service.');
		return;
	}

	mithril.core.logger.debug('Comm sending', msg, 'to', relay);

	msg = Message.pack(address, action, msg);

	client.send([relay], msg, meta);
}


exports.send = function (address, relay, msg) {
	sendToClient(address, relay, store.ACTIONS.STORE, msg);
};

exports.confirm = function (address, relay, msgIds) {
	sendToClient(address, relay, store.ACTIONS.CONFIRM, JSON.stringify(msgIds));
};

exports.connect = function (address, relay) {
	mithril.core.logger.debug('Connecting on address', address, 'with relay', relay);

	sendToClient(address, relay, store.ACTIONS.CONNECT, null, new Meta(null, null, meta.FLAGS.REPLY_EXPECTED));
};

exports.disconnect = function (address, relay) {
	sendToClient(address, relay, store.ACTIONS.DISCONNECT, null);
};

exports.forward = function (address, relay) {
	mithril.core.logger.debug('Forwarding for address', address, 'with relay', relay);

	sendToClient(address, relay, store.ACTIONS.FORWARD, null, new Meta(null, null, meta.FLAGS.REPLY_EXPECTED));
};


function setupClient(uri) {
	// send, receive

	var Client = require('./mmrp/client').Client;
	client = new Client(uri);

	client.on('message', deliverMessagePackageLocal);

	mithril.on('shutdown', function () {
		mithril.core.logger.info('Closing mmrp client...');

		client.close();
	});
}


// relay

function handleMessageStoreResponse(data, sendTo) {
	// if the store wants us to deliver a message, send it

	if (data && sendTo) {
		var metadata = new Meta(null, null, meta.FLAGS.IS_RESPONSE_PKT);
		var packet = sendTo;

		metadata.dataPosition = packet.length;

		packet.push(data, metadata.data);			// the message (no need to serialize, because it's datatype unknown) and metadata

		relay.sendReply(metadata, packet);
	}
}


function setupStoreRelay(identity, cfgExpose, uri) {
	mithril.core.logger.info('Setting up msgServer store relay');

	var messageStore = new Store();

	// create a relay

	var Relay = require('./mmrp/relay').Relay;
	relay = new Relay(identity, uri);

	relay.on('message', function (data, sender) {
		// this relay was the endpoint for the message

		messageStore.process(data, sender, handleMessageStoreResponse);
	});

	mithril.on('shutdown', function () {
		mithril.core.logger.info('Closing mmrp relay...');

		relay.close();
	});


	// peer discovery and announcement

	var services = mithril.core.serviceDiscovery;

	if (services) {
		var serviceName = mithril.core.config.get('server.mmrp.serviceDiscovery.name');

		if (!serviceName) {
			mithril.fatalError('server.mmrp.serviceDiscovery.name not configured.');
		}

		var socketDescription;

		if (cfgExpose) {
			// hostname is optional and can be read from the OS

			var host = cfgExpose.host || require('os').hostname();
			var port = cfgExpose.port;

			if (!host || !port) {
				mithril.core.logger.error('Malformed mmrp exposure configuration. Not exposing this service.');
			} else {
				socketDescription = 'tcp://' + host + ':' + port;

				services.announce(serviceName, port, { listen: socketDescription });
			}
		} else {
			mithril.core.logger.info('Not exposing this service.');
		}

		services.on(serviceName + '.up', function (host, port, data) {
			mithril.core.logger.info('mdns service up', serviceName, host, port, data);

			var listen = data.listen;

			// if there is a socket URI to connect to, and it does not match the URI we broadcast, try to connect

			if (listen && listen !== socketDescription) {
				// make sure the URI is reachable (else zmq's connect will do an assert failure and kill the process)

				var m = listen.match(/^tcp:\/\/(.+):([0-9]+)$/);
				if (m) {
					// tcp connection, so we do a dns check

					var hostname = m[1];

					require('dns').lookup(hostname, 4, function (error, ip, family) {
						if (error || !ip) {
							mithril.core.logger.error('DNS lookup failed for', listen);
							return;
						}

						// apparently the provided hostname can be resolved, so connect

						mithril.core.logger.info('Relay connecting to', listen);
						relay.connect(listen);
					});
				} else {
					// not a tcp connection, so we do not connect

					mithril.core.logger.info(listen, 'does not seem to be a TCP socket, so ignored.');
				}
			}
		});

		services.on(serviceName + '.down', function (host, port, data) {
			// game peer down, but we do not disconnect

			mithril.core.logger.info('mdns service down', serviceName, host, port, data);
		});
	}
}


exports.setup = function () {
	// register the clientHost variable

	clientHost = mithril.core.msgServer.getClientHost();

	// set up mmrp

	var cfgBind   = mithril.core.config.get('server.mmrp.bind');
	var cfgExpose = mithril.core.config.get('server.mmrp.expose');

	if (cfgBind) {
		if (cfgBind.protocol !== 'zmq') {
			mithril.fatalError('mmrp protocol "' + cfgBind.protocol + '" not supported.');
		}

		var uri;

		if (cfgBind.host && cfgBind.port) {
			uri = 'tcp://' + cfgBind.host + ':' + cfgBind.port;
		} else if (cfgBind.file) {
			uri = 'ipc://' + cfgBind.file;
		} else {
			mithril.fatalError('mmrp bindings incomplete ("host" and "port", or "file" required)');
		}

		var identity = hostname;

		if (!mithril.isWorker) {
			setupStoreRelay(identity, cfgExpose, uri);
		}

		if (!mithril.isMaster) {
			setupClient(uri);
		}
	}
};

