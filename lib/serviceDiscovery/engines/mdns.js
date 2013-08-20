var util = require('util');
var Service = require('../service').Service;
var ServiceNode = require('../node').ServiceNode;
var mage = require('../../mage');

// our mdns instance, only require it when needed
var mdns;

/**
 * Hosts in mDNS are announced with a trailing dot, remove it
 *
 * @param {string} host
 * @returns {string}
 */
function normalizeHost(host) {
	if (!host) {
		return host;
	}

	if (host[host.length - 1] === '.') {
		host = host.substring(0, host.length - 1);
	}

	return host;
}

/**
 * This is our service object, it starts a browser object so that if can forward up and down events when nodes appear
 * on the network.
 *
 * @param type
 * @param options
 * @constructor
 */
function MDNSService(name, type, options) {
	var that = this;

	this.name = name;
	this.type = type;
	this.options = options;
	this.browser = new mdns.Browser(mdns.makeServiceType(this.name, this.type));

	this.browser.on('serviceUp', function (service) {
		// this is our representation of a node, it contains the host, ips, port and metadata of a service
		var node = new ServiceNode(normalizeHost(service.host), service.port, service.addresses, service.txtRecord);

		//logger.debug.data(node.data).log('New service up:', node.host, 'on', node.getIp(4), 'and port', node.port);

		that.emit('up', node);
	});

	this.browser.on('serviceDown', function (service) {
		// this is our representation of a node, it contains the host, ips, port and metadata of a service
		var node = new ServiceNode(normalizeHost(service.host), service.port, service.addresses, service.txtRecord);

		that.emit('down', node);
	});

	this.browser.on('error', function (error) {
		that.emit('error', error);
	});
}

util.inherits(MDNSService, Service);

/**
 * Announce our service on the mDNS network
 *
 * @param {string}   protocol
 * @param {number}   port
 * @param {Object}   metadata
 * @param {Function} cb
 */
MDNSService.prototype.announce = function (port, metadata, cb) {
	if (this.advertisement) {
		// stop current advertisement
		this.advertisement.stop();
	}

	var serviceType = mdns.makeServiceType(this.name, this.type);

	// create our service annoucement options
	var serviceOptions = {
		// set the description to be the service name, followed by the game name and finally the PID
		name: '[' + process.pid + '] ' + mage.rootPackage.name,
		// this is our metadata
		txtRecord: metadata
	};

	// Advertise me!
	this.advertisement = mdns.createAdvertisement(serviceType, port, serviceOptions, function (error) {
		if (cb) {
			cb(error);
		}
	});

	// start announcing
	this.advertisement.start();
};

MDNSService.prototype.discover = function () {
	// start browsing
	this.browser.start();
};

/**
 * Setups a version of the service using the type and options provided
 *
 * @param type
 * @param options
 * @returns {MDNSService}
 */
exports.setup = function (type, options) {
	if (!mdns) {
		try {
			mdns = require('mdns');
		} catch (error) {
			throw new Error('Could not load node-mdns');
		}
	}

	return new MDNSService(type, options);
};
