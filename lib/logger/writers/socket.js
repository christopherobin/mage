var util	= require('util'),
	WSS		= require('ws').Server,
	cluster = require('cluster'),
	zmq		= require('zmq'),
    logger  = require('../index'),
	writer	= require('./writer');

var COLLECTOR = '/logCollector.sock',
    ANNOUNCER = '/channelAnnouncer.sock';

function SocketWriter(cfg, parser) {

	var id   = 0,
		that = this;

	this.parser				= parser;
	this.server				= new WSS({ port: cfg.port });
	this.path				= cfg.path || '/tmp';
	this.isWorker			= cluster.isWorker;
	this.channelClients		= {
	};

	var INVALID_DATA = JSON.stringify("Invalid data");

	if (this.isWorker) {
		this.setupLogForwarder();
		return;
	} else {
		this.setupLogCollector();
	}

	this.server.on('connection', function (conn) {

		var connId = id++;

		var cleanChannels = function () {
			for (var channel in that.channelClients) {
				delete that.channelClients[channel][connId];

				if (Object.keys(that.channelClients[channel]).length === 0) {
					delete that.channelClients[channel];
				}
			}
		};

		conn.on('message', function (message) {

			var channels;

			try {
				channels = JSON.parse(message);
			} catch (e) {
				return conn.send(INVALID_DATA);
			}

			cleanChannels();

			for (var i = 0; i < channels.length; i++) {

				var channel = channels[i];

				if (!that.channelClients[channel]) {
					that.channelClients[channel] = {};
				}

				that.channelClients[channel][connId] = conn;
			}

			channels = Object.keys(that.channelClients);
			that.reconfigureListeners(channels);

			if (that.orders) {
				that.orders.send('orders ' + JSON.stringify(channels));
			}
		});
	});
}

util.inherits(SocketWriter, writer.writer);

SocketWriter.prototype.channelFunctionGenerator = function (channel) {

	var that   = this;
	var conns  = this.channelClients[channel];


	if (this.isWorker) {
		return function (log) {

			var data;
			log.pid  = process.pid;
			data = JSON.stringify(log);

			that.forwarder.send(channel + ' ' + data);
		};
	} else {
		return function (log) {

			var data;

			if (!log.pid) {
				log.pid  = process.pid;
			}

			log.channel = channel;
			data = JSON.stringify(log);

			for (var id in conns) {
                that.send(channel, id, data);
			}
		};
	}
};

SocketWriter.prototype.send = function (channel, id, data) {
    var that = this;
    this.channelClients[channel][id].send(data, function (err) {
        if (err) {
            that.channelClients[channel][id].close();
            delete that.channelClients[channel][id];
        }
    });
};

SocketWriter.prototype.setupLogForwarder = function () {
	var that = this;

	this.forwarder = zmq.socket('push');
	this.forwarder.connect('ipc://' + this.path + COLLECTOR);

	this.orders = zmq.socket('sub');
	this.orders.connect('ipc://' + this.path + ANNOUNCER);
	this.orders.subscribe('orders');

	this.orders.on('message', function (msg) {
		var channels = JSON.parse(msg.slice(7));
		that.reconfigureListeners(channels);
	});
};

SocketWriter.prototype.setupLogCollector = function () {
	var that = this;

	this.collector = zmq.socket('pull');
	this.collector.bind('ipc://' + this.path + COLLECTOR, function (err) {
        if (err) {
            logger.error(new Error('Could not set log collector for socket logger'));
        }
    });

	this.collector.on('message', function (msg) {
		msg = msg.toString();

		var firstSpace = msg.indexOf(' ');
		var channel = msg.substr(0, firstSpace);
		var log = JSON.parse(msg.substr(firstSpace + 1));

		that[channel](log);
	});

	this.orders = zmq.socket('pub');
	this.orders.bind('ipc://' + this.path + ANNOUNCER, function (err) {
		if (err) {
            logger.error(new Error('Could not set log channel announcer for socket logger'));
		}
	});
};

module.exports = SocketWriter;
