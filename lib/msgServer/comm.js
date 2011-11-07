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
    meta      = require('./mmrp/meta');
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
		console.error('Trying to send a message, on a non-client service.');
		return;
	}

	msg = Message.pack(address, action, msg);

	client.send([relay], msg, meta);
}


exports.send = function (address, relay, msg) {
	sendtoClient(address, relay, store.ACTIONS.STORE, msg);
};

exports.confirm = function (address, relay, msgIds) {
	sendToClient(address, relay, store.ACTIONS.CONFIRM, msdIds);
};

exports.connect = function (address, relay) {
	sendToClient(address, relay, store.ACTIONS.CONNECT, null, new Meta(null, null, meta.FLAGS.REPLY_EXPECTED));
};

exports.disconnect = function (address, relay) {
	sendToClient(address, relay, store.ACTIONS.DISCONNECT, null);
};

exports.forward = function (address, relay) {
	sendToClient(address, relay, store.ACTIONS.FORWARD, null, new Meta(null, null, meta.FLAGS.REPLY_EXPECTED));
};


function setupClient(uri) {
	// send, receive

	var Client = require('./mmrp/client').Client;
	client = new Client(uri);

	client.on('message', deliverMessagePackageLocal);
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


function setupStoreRelay(identity, zmqPort, uri) {
	var messageStore = new Store();

	// TODO: expose 2 socket connections (1 ipc, 1 tcp for other masters to connect to)

	mithril.core.logger.debug('Setting up msgServer store relay');


	// create a relay

	var Relay = require('./mmrp/relay').Relay;
	relay = new Relay(identity, uri);

	relay.on('message', function (data, sender) {
		// this relay was the endpoint for the message

		messageStore.process(data, sender, handleMessageStoreResponse);
	});


	// peer discovery and announcement

	var services = mithril.core.serviceDiscovery;

	if (services) {
		var serviceName = mithril.getConfig('server.mmrp.serviceDiscovery.name');

		if (!serviceName) {
			mithril.fatalError('server.mmrp.serviceDiscovery.name not configured.');
		}

		services.announce(serviceName, zmqPort, { listen: uri });

		services.on(serviceName + '.up', function (host, port, data) {
			if (host === hostname && port === zmqPort) {
				return;
			}

			var listen = data.listen;

			if (listen && listen.substring(0, 4) === 'tcp/') {
				relay.connect(listen);
			}
		});

		services.on(serviceName + '.down', function (host, port, data) {
			// game peer down, but we do not disconnect
		});
	}
}


exports.setup = function () {
	// register the clientHost variable

	clientHost = mithril.core.msgServer.getClientHost();

	// set up mmrp

	var cfg = mithril.getConfig('server.mmrp.bind');

	if (cfg) {
		if (cfg.protocol !== 'zmq') {
			mithril.fatalError('mmrp protocol "' + cfg.protocol + '" not supported.');
		}

		var uri;
		var zmqPort = cfg.port || null;

		if (cfg.host && cfg.port) {
			uri = 'tcp://' + cfg.host + ':' + cfg.port;
		} else if (cfg.file) {
			uri = 'ipc://' + cfg.file;
		} else {
			mithril.fatalError('mmrp bindings incomplete ("host" and "port", or "file" required)');
		}

		var identity = hostname;	// TODO: hash this!

		if (!mithril.isWorker) {
			setupStoreRelay(identity, zmqPort, uri);
		}

		if (!mithril.isMaster) {
			setupClient(uri);
		}
	}
};

