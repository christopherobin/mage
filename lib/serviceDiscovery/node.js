var os = require('os');
var net = require('net');

// prebuilt list of local ips
var localIps = {IPv4: [], IPv6: []};

var interfaces = os.networkInterfaces();
var interfacesKeys = Object.keys(interfaces);

// iterate on each interfaces
for (var i = 0; i < interfacesKeys.length; i++) {
	var interface = interfaces[interfacesKeys[i]];

	// each interface may have more than one ip
	for (var j = 0; j < interface.length; j++) {
		var ip = interface[j];

		// ignore internal ips
		if (ip.internal) {
			continue;
		}

		// unsupported format
		if (!localIps[ip.family]) {
			// maybe log?
			continue;
		}

		localIps[ip.family].push(ip.address);
	}
}

/**
 * This the representation of a node on the discovery network
 *
 * @param {string}   host       The hostname for the node
 * @param {number}   port       The port on which the service is reachable
 * @param {string[]} addresses  A list of ips on which the service is reachable
 * @param {Object}   [metadata] The metadata announced by the service
 * @constructor
 */
function ServiceNode(host, port, addresses, metadata) {
	this.host = host;
	this.port = port;
	this.addresses = addresses;
	this.data = metadata || {};
}

/**
 * Return the first IP that match the requested version
 *
 * @param {number} version The IP version number (either 4 or 6)
 * @returns {string|null}
 * @throws {Error} Throws an error if the version number is invalid
 */
ServiceNode.prototype.getIp = function (version) {
	if (!this.addresses) {
		return null;
	}

	var checkMethod = net['isIPv' + version];

	if (!checkMethod) {
		throw new Error('Invalid IP type requested');
	}

	for (var i = 0; i < this.addresses.length; i++) {
		if (checkMethod(this.addresses[i])) {
			return this.addresses[i];
		}
	}
};

ServiceNode.prototype.isLocal = function () {
	var ip = this.addresses[0];

	if (!ip) {
		// what do?
		return false;
	}

	var version = 'IPv4';
	if (net.isIPv6(ip)) {
		version = 'IPv6';
	}

	// if we find it in the local ips, then we are good!
	if (localIps[version].indexOf(ip) !== -1) {
		return true;
	}

	return false;
};

exports.ServiceNode = ServiceNode;