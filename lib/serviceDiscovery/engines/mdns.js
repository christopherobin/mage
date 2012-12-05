var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Service = require('../').Service;
var mdns;


function normalizeHost(host) {
	// strip trailing dot from the host

	if (host[host.length - 1] === '.') {
		host = host.substring(0, host.length - 1);
	}

	return host;
}


// map for all mdns services created (to check for uniqueness)
// key is the service name, which is unique across the domain

var services = {};


try {
	mdns = require('mdns');
} catch (error) {
	throw new Error('Could not load node-mdns.');
}

// node-mdns user guide: http://agnat.github.com/node_mdns/user_guide.html


function MDNSService(serviceType) {
	Service.call(this, serviceType);
}

util.inherits(MDNSService, Service);


MDNSService.prototype.announce = function (cb) {
	var service = this;

	var options = {};

	if (this.desc) {
		options.name = this.desc.substr(0, 63);
	}

	if (this.host) {
		options.host = this.host;
	}

	if (this.data) {
		options.txtRecord = this.data;
	}

	// register the service now, so that even when the listen-event comes in, we'll
	// recognize it as our own

	// advertise!

	this.mdnsAdvertisement = mdns.createAdvertisement(this.serviceType.mdnsServiceType, this.port, options, function (error, mdnsService) {
		if (error) {
			if (cb) {
				cb(error);
			}
			return;
		}

		// name may have changed, due to the auto-rename facility in mdns

		service.setDescription(mdnsService.name);

		services[mdnsService.name] = service;

		if (cb) {
			cb(null, service);
		}
	});

	this.start();
};


MDNSService.prototype.start = function () {
	if (this.mdnsAdvertisement) {
		this.mdnsAdvertisement.start();
	}
};


MDNSService.prototype.stop = function () {
	if (this.mdnsAdvertisement) {
		this.mdnsAdvertisement.stop();
	}
};


function ServiceType(name, protocol, version) {
	EventEmitter.call(this);

	var serviceType = { name: name, protocol: protocol };

	if (version) {
		// mdns subtypes are used to filter which services are found when browsing
		// You may announce more than 1 subtype, but only browse for 1 at a time.

		// For more info, read:
		// http://developer.apple.com/library/mac/#documentation/Networking/Reference/DNSServiceDiscovery_CRef/Reference/reference.html

		// To match up services correctly, we should only ever consider a single version tag.

		serviceType.subtypes = [version];
	}

	this.mdnsServiceType = mdns.makeServiceType(serviceType);
	this.browser = null;
}


util.inherits(ServiceType, EventEmitter);


ServiceType.prototype.listen = function () {
	var that = this;

	// create the browser

	this.browser = mdns.createBrowser(this.mdnsServiceType);

	this.browser.on('error', function (error) {
		that.emit('error', error);
	});

	this.browser.on('serviceUp', function (mdnsService) {
		var service = services[mdnsService.name];
		if (!service) {
			service = that.createService();
			services[mdnsService.name] = service;
		}

		service.setHost(normalizeHost(mdnsService.host));
		service.setPort(mdnsService.port);
		service.setIps(mdnsService.addresses);
		service.setDescription(mdnsService.name);
		service.setData(mdnsService.txtRecord || {});

		// emit the right event, and make sure it's only emitted once

		// node-mdns will fire events multiple times sometimes, read more:
		// http://agnat.github.com/node_mdns/user_guide.html#browser

		if (!service.isUp) {
			service.isUp = true;
			that.emit('up', service);
		}
	});

	this.browser.on('serviceDown', function (mdnsService) {
		var service = services[mdnsService.name];
		if (service) {
			if (service.mdnsAdvertisement) {
				// don't emit for advertised services
				return;
			}

			if (service.isUp) {
				service.isUp = false;
				that.emit('down', service);
			}
		}
	});

	this.browser.start();
};


ServiceType.prototype.createService = function () {
	return new MDNSService(this);
};


ServiceType.prototype.close = function () {
	for (var key in services) {
		services[key].stop();
	}

	if (this.browser) {
		this.browser.stop();
		this.browser = null;
	}

	this.removeAllListeners();
};


exports.ServiceType = ServiceType;
