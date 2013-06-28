var EventEmitter = require('events').EventEmitter;
var util = require('util');
var net = require('net');
var osNetworkInterfaces = require('os').networkInterfaces();

var engines = {};

var engineTypes = ['mdns'];


function Service(serviceType) {
	EventEmitter.call(this);

	this.serviceType = serviceType;
	this.host = null;
	this.ips = null;
	this.port = null;
	this.data = null;
	this.desc = null;
	this.isUp = false;
}

util.inherits(Service, EventEmitter);


Service.prototype.isThisHost = function () {
	for (var interface in osNetworkInterfaces) {
		for (var addressType in osNetworkInterfaces[interface]) {
			if (this.ips.indexOf(osNetworkInterfaces[interface][addressType].address) !== -1) {
				return true;
			}
		}
	}

	return false;
};


Service.prototype.announce = function (cb) {
	var error = new Error('Announce not implemented.');

	if (cb) {
		cb(error);
	}
};


Service.prototype.setHost = function (host) {
	this.host = host;
};


Service.prototype.setIps = function (ips) {
	this.ips = ips;
};


Service.prototype.getIp = function (version) {
	if (this.ips) {
		for (var i = 0, len = this.ips.length; i < len; i++) {
			var ip = this.ips[i];
			var isIp = net.isIP(ip);

			if (isIp && (!version || version === isIp)) {
				return ip;
			}
		}
	}
};


Service.prototype.setPort = function (port) {
	this.port = port;
};


Service.prototype.setData = function (data) {
	this.data = data;
};


Service.prototype.setDescription = function (desc) {
	this.desc = desc;
};


exports.Service = Service;


exports.createServiceType = function (engineType, name, protocol, version) {
	var engine = engines[engineType];

	if (!engine) {
		if (engineTypes.indexOf(engineType) === -1) {
			throw new Error('Service discovery engine-type not supported: ' + engineType);
		}

		engines[engineType] = engine = require('./engines/' + engineType);
	}

	var serviceType = new engine.ServiceType(name, protocol, version);

	serviceType.on('newListener', function browserTrigger(eventName) {
		if (eventName === 'up' || eventName === 'down') {
			serviceType.removeListener('newListener', browserTrigger);
			serviceType.listen();
		}
	});

	return serviceType;
};
