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

	console.log('About to pass a message to a client');

	if (clientHost) {
		clientHost.deliverMessages(dst[0], Response.unpack(msgs));
	}
}


function sendToClient(address, relay, action, msg, meta) {
	if (!client) {
		console.error('Trying to send a message, on a non-client service.');
		return;
	}

	msg = Message.pack(address, action, msg);

	client.send([relay], msg, meta);
}


exports.send = function (address, relay, msg) {
	sendToClient(address, relay, store.ACTIONS.STORE, msg);
};

exports.confirm = function (address, relay, msgIds) {
	sendToClient(address, relay, store.ACTIONS.CONFIRM, msgIds);
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
		var serviceName = mithril.getConfig('server.mmrp.serviceDiscovery.name');

		if (!serviceName) {
			mithril.fatalError('server.mmrp.serviceDiscovery.name not configured.');
		}

		if (cfgExpose) {
			if (!cfgExpose.host || !cfgExpose.port) {
				mithril.core.logger.error('Malformed mmrp exposure configuration. Not exposing this service.');
			} else {
				services.announce(serviceName, cfgExpose.port, { listen: 'tcp://' + cfgExpose.host + ':' + cfgExpose.port });
			}
		} else {
			mithril.core.logger.info('Not exposing this service.');
		}

		services.on(serviceName + '.up', function (host, port, data) {
			if (cfgExpose && host === cfgExpose.host && port === cfgExpose.port) {
				return;
			}

			mithril.core.logger.info('mdns service up', serviceName, host, port, data);

			var listen = data.listen;

			if (listen && listen.substring(0, 6) === 'tcp://') {
				mithril.core.logger.info('Relay connecting to', listen);

				relay.connect(listen);
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

	var cfgBind   = mithril.getConfig('server.mmrp.bind');
	var cfgExpose = mithril.getConfig('server.mmrp.expose');

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

