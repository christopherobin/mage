var util = require('util');
var Service = require('../../service').Service;
var ServiceNode = require('../../node').ServiceNode;
var os = require('os');
var mage = require('../../../mage');
var logger = mage.core.logger.context('zooKeeper');

// the zooKeeper client library
var zooKeeper;

// our zookeeper client instance
var zooKeeperClient;

// choose the first valid ip as the one we will announce
var announceIps;

/**
 * Finds the first available IP from the local network interfaces
 *
 * @returns {string} The IP
 * @todo Support from env variables?
 */
function getAnnounceIps() {
	if (announceIps) {
		return announceIps;
	}

	var interfaces = os.networkInterfaces();
	var ifaceNames = Object.keys(interfaces);

	announceIps = [];
	for (var i = 0; i < ifaceNames.length; i++) {
		var addresses = interfaces[ifaceNames[i]];

		for (var j = 0; j < addresses.length; j++) {
			var address = addresses[j];

			// skip anything that doesn't interest us
			if (address.internal) {
				continue;
			}

			// found it, store it and break
			announceIps.push(address.address);
		}
	}

	// just in case
	return announceIps;
}

/**
 * Retrieve our zookeeper client, or create it if necessary
 *
 * @param options
 * @returns {zooKeeper.client}
 */
function getZooKeeperClient(options) {
	if (zooKeeperClient) {
		return zooKeeperClient;
	}

	// connect to the database
	if (!options || !options.hosts) {
		throw new Error('Missing configuration server.discoveryService.options.hosts for ZooKeeper');
	}

	zooKeeperClient = zooKeeper.createClient(options.hosts);
	// connect asap
	zooKeeperClient.connect();

	// manually closing stuff makes the ephemeral nodes disappear instantly instead of several seconds later
	mage.once('shutdown', function () {
		zooKeeperClient.close();
	});

	return zooKeeperClient;
}

/**
 * This is our service instance for zookeeper
 *
 * @param {string} name    The name of the service we want to announce
 * @param {string} type    The type of service (tcp or udp)
 * @param {Object} options The options to provide to the service
 * @constructor
 */
function ZooKeeperService(name, type, options) {
	this.name = name;
	this.type = type;
	this.client = getZooKeeperClient(options);

	// this is the base path we will use to announce this service
	this.baseAnnouncePath = ['/mage', this.name, this.type].join('/');

	// those are the nodes we know on the given path
	this.nodes = [];

	// node data is stored apart
	this.nodesData = {};
}

util.inherits(ZooKeeperService, Service);

/**
 * Do the real announcement. Because we need to run checks on parent nodes we need a way to do the final announce.
 *
 * @param {zooKeeper.Client} client
 * @param {string}           baseAnnouncePath
 * @param {number}           port
 * @param {Object}           metadata
 * @param {Function}         cb
 * @private
 */
function realAnnounce(client, baseAnnouncePath, port, metadata, cb) {
	var dataBuffer = new Buffer(JSON.stringify(metadata));
	var fullAnnouncePath = [baseAnnouncePath, os.hostname() + ':' + port].join('/');

	logger.verbose('Announcing', fullAnnouncePath);

	// create an ephemeral node, an ephemeral node is automatically deleted when the client disconnect
	// the callback will echo the path back after the error, so we silence it
	client.create(fullAnnouncePath, dataBuffer, zooKeeper.CreateMode.EPHEMERAL, function (error) {
		cb(error);
	});
}

/**
 * Announce our service to the world
 *
 * @param {number}   port
 * @param {Object}   metadata
 * @param {Function} cb
 */
ZooKeeperService.prototype.announce = function (port, metadata, cb) {
	var that = this;

	// enrich metadata with some extra stuff from us
	metadata = {
		ips: getAnnounceIps(),
		data: metadata
	};

	// check if the parent path exists
	this.client.exists(this.baseAnnouncePath, function (error, stat) {
		if (error) {
			return cb(error);
		}

		// if the main node already exists, just leave it there and announce
		if (stat) {
			realAnnounce(that.client, that.baseAnnouncePath, port, metadata, cb);
		} else {
			// otherwise we need to create it
			that.client.mkdirp(that.baseAnnouncePath, function (error) {
				if (error) {
					return cb(error);
				}

				// then do the real announce
				realAnnounce(that.client, that.baseAnnouncePath, port, metadata, cb);
			});
		}
	});
};

/**
 * Retrieve the details from a node, then emit the `up` event with the node details
 *
 * @param {string} node
 * @private
 */
ZooKeeperService.prototype.discoverNode = function (node) {
	var that = this;

	// get the data from the node
	this.client.getData([this.baseAnnouncePath, node].join('/'), function (error, data) {
		if (error) {
			that.emit('error', error);
			return;
		}

		// parse the metadata
		data = JSON.parse(data);

		// retrieve the host/port from the node name
		var nodeData = node.split(':');
		var host = nodeData[0];
		var port = nodeData[1];

		// store the metadata so that we can retrieve it when the node goes down
		that.nodesData[node] = data;

		// emit the up signal
		that.emit('up', new ServiceNode(host, port, data.ips, data.data));
	});
};

/**
 * Called when an event happened on our parent node, it will retrieve the list of children and update the network
 * informations
 *
 * @param {zooKeeper.Event} event
 * @private
 */
ZooKeeperService.prototype.onWatchEvent = function (event) {
	var that = this;
	logger.verbose.data(event).log('ZooKeeper path changed');

	function onWatch(event) {
		that.onWatchEvent(event);
	}

	if ((event.name === 'NODE_CHILDREN_CHANGED') && (event.path === this.baseAnnouncePath)) {
		this.client.getChildren(this.baseAnnouncePath, onWatch, function (error, children) {
			if (error) {
				that.emit('error', error);
				return;
			}

			logger.verbose.data(children).log('Updating network');

			that.updateNetwork(children);
		});
	}
};

/**
 * Takes a list of nodes (ip:port as a string) and checks for differences with the currently known nodes on the network.
 *
 * @param {string[]} children
 * @private
 */
ZooKeeperService.prototype.updateNetwork = function (children) {
	// we move new nodes and already known nodes there so that we can list deleted nodes easily
	var newNetwork = [];

	for (var i = 0; i < children.length; i++) {
		var child = children[i];
		var n;

		if ((n = this.nodes.indexOf(child)) === -1) {
			newNetwork.push(child);

			logger.verbose('New node on the network', child);

			this.discoverNode(child);
		} else {
			newNetwork.push(this.nodes.splice(n, 1)[0]);
		}
	}

	// now everything left are nodes that don't exists anymore on the network, delete them
	for (i = 0; i < this.nodes.length; i++) {
		var node = this.nodes[i];

		logger.verbose('Down node', node);

		// retrieve the host/port from the node name
		var nodeData = node.split(':');
		var host = nodeData[0];
		var port = nodeData[1];
		var data = this.nodesData[node];

		// emit the down signal
		this.emit('down', new ServiceNode(host, port, data.ips, data.data));

		// we don't need the node's data anymore, remove it
		delete this.nodesData[node];
	}

	logger.verbose.data(newNetwork).log('Network updated!');

	// then switch old network map with new one
	this.nodes = newNetwork;
};

/**
 * Start the discovery process
 */
ZooKeeperService.prototype.discover = function () {
	var that = this;


	function onWatch(event) {
		that.onWatchEvent(event);
	}

	this.client.getChildren(this.baseAnnouncePath, onWatch, function (error, children) {
		if (error) {
			that.emit('error', error);
		}

		logger.debug.log('Discovering network');

		that.updateNetwork(children);
	});
};

exports.setup = function (name, type, options) {
	if (!zooKeeper) {
		try {
			zooKeeper = require('node-zookeeper-client');
		} catch (error) {
			throw new Error('Could not load the zookeeper client, please make sure that you installed the node module.');
		}
	}

	return new ZooKeeperService(name, type, options);
};