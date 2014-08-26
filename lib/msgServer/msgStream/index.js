// The message stream connection with the end-user is managed here

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var mage = require('../../mage');
var logger = mage.core.logger.context('msgStream');

var HttpPollingHost = require('./transports/http-polling').HttpPollingHost;


// address type handlers (eg: session)

var addressTypes = {};

exports.addAddressType = function (name, fn) {
	assert.equal(fn.length, 3, 'Address lookup functions must accept 3 arguments (host, address, cb)');

	addressTypes[name] = fn;
};


/**
 * The Message Stream handler which wraps around all supported transport types
 *
 * @param {Object} [cfg]
 * @constructor
 */

function MsgStream(cfg) {
	EventEmitter.call(this);

	this.cfg = cfg || {};
	this.addressMap = {};
}

util.inherits(MsgStream, EventEmitter);


exports.MsgStream = MsgStream;


MsgStream.prototype.addHost = function (address, host) {
	var addressMap = this.addressMap;

	var prevHost = addressMap[address];

	if (prevHost) {
		prevHost.close();
	}

	addressMap[address] = host;

	host.on('close', function () {
		delete addressMap[address];
	});
};


MsgStream.prototype.close = function () {
	var addresses = Object.keys(this.addressMap);
	var len = addresses.length;

	logger.debug('Closing all', len, 'connection(s)');

	for (var i = 0; i < len; i += 1) {
		var host = this.addressMap[addresses[i]];

		if (host) {
			host.close();
		}
	}
};


MsgStream.prototype.managesAddress = function (address) {
	return this.addressMap.hasOwnProperty(address);
};


MsgStream.prototype.deliver = function (address, msgs) {
	var host = this.addressMap[address];

	if (host) {
		logger.verbose('Delivering messages to', address);

		host.deliver(msgs);
	} else {
		logger.warning('Could not deliver messages to', address, '(address gone)');
	}
};


// hook up a transport host to the message store through the message server

MsgStream.prototype.connectHostToStore = function (clusterId, address, host) {
	var that = this;

	// confirm previous messages

	if (host.getConfirmIds) {
		var ids = host.getConfirmIds();

		if (ids) {
			this.emit('confirm', address, clusterId, ids);
		}
	}

	// connect to the store

	this.emit('connect', address, clusterId, host.getDisconnectStyle());

	// if any new confirmations come in, we must inform the message server

	host.on('confirm', function (ids) {
		that.emit('confirm', address, clusterId, ids);
	});
};


MsgStream.prototype.handleRequest = function (host) {
	var that = this;

	// resolve the session (or whatever authentication mechanism gets implemented)

	var addressInfo = host.getAddressInfo();

	assert(addressInfo);
	assert(addressInfo.address);
	assert(addressInfo.type);

	var lookupAddress = addressTypes[addressInfo.type];

	if (typeof lookupAddress !== 'function') {
		logger.warning('Unknown address type:', addressInfo);

		host.respondBadRequest('Unknown address type: ' + addressInfo.type);
		return;
	}

	lookupAddress(host, addressInfo.address, function (clusterId, address) {
		// remember this transport so we can deliver messages to it later

		that.addHost(address, host);

		// connect transport to the store

		that.connectHostToStore(clusterId, address, host);
	});
};


MsgStream.prototype.getTransportConfig = function (transport) {
	if (this.cfg.transports && this.cfg.transports[transport]) {
		return this.cfg.transports[transport];
	}

	return {};
};


MsgStream.prototype.handleHttpRequest = function (req, res, query) {
	// instantiate the transport over HTTP

	var transport = query.transport;
	var cfg = this.getTransportConfig(transport);

	var host;

	switch (transport) {
	case 'longpolling':
		host = new HttpPollingHost('longpolling', cfg);
		break;
	case 'shortpolling':
		host = new HttpPollingHost('shortpolling', cfg);
		break;
	default:
		logger.warning.data(req).log('Unknown HTTP transport:', transport);

		if (req.method === 'HEAD') {
			host.respondBadRequest();
		} else {
			host.respondBadRequest('Invalid transport: ' + transport);
		}
		return;
	}

	// pass ownership of req/res over to the transport

	host.setConnection(req, res);

	if (req.method === 'HEAD') {
		logger.verbose.data(req).log('Responding to HTTP HEAD request');

		// http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html
		host.respondToHead();
	} else {
		// we're now HTTP agnostic

		logger.verbose.data(req).log('Handling message stream HTTP request');

		this.handleRequest(host);
	}
};


MsgStream.prototype.bindToHttpServer = function (httpServer) {
	var that = this;

	httpServer.addRoute(this.cfg.route, function (req, res, path, query) {
		try {
			that.handleHttpRequest(req, res, query);
		} catch (error) {
			logger.error('Error while handling HTTP request:', error);
		}
	}, 'simple');

	httpServer.server.on('close', function () {
		that.close();
	});
};
