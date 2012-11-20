var util = require('util'),
	path = require('path'),
	WSS = require('ws').Server,
	cluster = require('cluster'),
	zmq = require('zmq'),
	loggingService = require('../'),
	Writer = require('./writer');

var COLLECTOR = 'logCollector.sock',
    ANNOUNCER = 'logChannelAnnouncer.sock';


function WebsocketWriter(cfg) {
	// TODO: what about the host?

	if (!cfg.port) {
		throw new Error('Cannot setup a websocket without a port');
	}

	this.port = cfg.port;

	var ipcPath = cfg.path || '/tmp';

	this.uriCollector = 'ipc://' + path.join(ipcPath, COLLECTOR);
	this.uriAnnouncer = 'ipc://' + path.join(ipcPath, ANNOUNCER);

	this.channelClients = {};

	if (cluster.isMaster) {
		// the master process collects logs from the workers

		this.setupChannelSyncServer();
		this.setupLogCollector();
	}

	if (cluster.isWorker) {
		// the workers send their logs to the master

		this.setupChannelSyncClient();
		this.setupLogForwarder();
	}

	if (!cluster.isWorker) {
		// workers don't host websockets

		this.setupWebsocketServer();
	}
}


util.inherits(WebsocketWriter, Writer);


WebsocketWriter.prototype.setupWebsocketServer = function () {
	// create the websocket server

	var id = 0;
	var that = this;

	function reconfigureListeners() {
		var channels = Object.keys(that.channelClients);

		that.reconfigureListeners(channels);

		if (that.channelSync) {
			that.channelSync.send(JSON.stringify(channels));
		}
	}

	function cleanChannels(connId) {
		for (var channel in that.channelClients) {
			delete that.channelClients[channel][connId];

			if (Object.keys(that.channelClients[channel]).length === 0) {
				delete that.channelClients[channel];
			}
		}
	}

	this.server = new WSS({ port: this.port });

	this.server.on('connection', function (conn) {
		var connId = id++;

		conn.on('close', function () {
			// a disappearing connection should no longer have its channel configuration matter

			cleanChannels(connId);
			reconfigureListeners();
		});

		conn.on('message', function (message) {
			// parse which channels this client wants to hear about

			var channels;

			try {
				channels = loggingService.parseChannelList(JSON.parse(message));
			} catch (e) {
				return conn.send('"Syntax error"');
			}

			// update which channels we care for based on the combined requirements
			// of all client connections

			cleanChannels(connId);

			for (var i = 0, len = channels.length; i < len; i++) {
				var channel = channels[i];

				if (!that.channelClients[channel]) {
					that.channelClients[channel] = {};
				}

				that.channelClients[channel][connId] = conn;
			}

			reconfigureListeners();

			conn.send(JSON.stringify({ listening: true, channels: channels }));
		});
	});
};


WebsocketWriter.prototype.channelFunctionGenerator = function (channel) {
	var that = this;

	if (cluster.isWorker) {
		// workers report logs to the master process

		return function (entry) {
			var data = JSON.stringify(entry);

			that.forwarder.send(channel + ' ' + data);
		};
	} else {
		// the channel function sends logs to all connections that care about this channel

		return function (entry) {
			that.broadcast(channel, entry);
		};
	}
};


WebsocketWriter.prototype.broadcast = function (channel, entry) {
	var data = JSON.stringify(entry);

	var conns = this.channelClients[channel];
	if (!conns) {
		return;
	}

	function sendToConn(connId) {
		var conn = conns[connId];

		conn.send(data, function (error) {
			if (error) {
				conn.close();
				delete conns[connId];
			}
		});
	}

	for (var connId in conns) {
		sendToConn(connId);
	}
};


WebsocketWriter.prototype.setupChannelSyncServer = function () {
	// channelSync announces which channels to care about, to all workers

	this.channelSync = zmq.socket('pub');
	this.channelSync.bind(this.uriAnnouncer, function (error) {
		if (error) {
			throw new Error('Could not set log channel announcer for socket logger');
		}
	});
};


WebsocketWriter.prototype.setupChannelSyncClient = function () {
	var that = this;

	this.channelSync = zmq.socket('sub');
	this.channelSync.connect(this.uriAnnouncer);
	this.channelSync.subscribe('channelSync');

	this.channelSync.on('message', function (channels) {
		that.reconfigureListeners(JSON.parse(channels));
	});
};


WebsocketWriter.prototype.setupLogForwarder = function () {
	// workers forward logs to the master
	// the master will collect it and report on the websocket

	this.forwarder = zmq.socket('push');
	this.forwarder.connect(this.uriCollector);
};


WebsocketWriter.prototype.setupLogCollector = function () {
	var that = this;

	// the collector receives log messages

	this.collector = zmq.socket('pull');
	this.collector.bind(this.uriCollector, function (error) {
        if (error) {
            throw new Error('Could not set log collector for socket logger');
        }
    });

	this.collector.on('message', function (msg) {
		msg = msg.toString();

		var firstSpace = msg.indexOf(' ');
		var channel = msg.substr(0, firstSpace);
		var entry = JSON.parse(msg.substr(firstSpace + 1));

		var fn = that[channel];
		if (fn) {
			fn(entry);
		}
	});
};

module.exports = WebsocketWriter;
