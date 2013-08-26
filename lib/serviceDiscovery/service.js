/**
 * @module serviceDiscovery
 */

var EventEmitter = require('events').EventEmitter;
var util = require('util');

/**
 * This is our constructor, you should parse the provided options based on your service's need
 *
  * @constructor
 */
function Service() {
	// do nothing
}

util.inherits(Service, EventEmitter);

/**
 * Announce your service to the whole world
 *
 * @param {number}   port       The service port
 * @param {Object}   [metadata] Some private metadata that the service may need for connection
 * @param {Function} [cb]       An optional callback, the first parameter will be an Error if anything wrong happened
 */
Service.prototype.announce = function (port, metadata, cb) {
	if (cb) {
		cb(new Error('Not implemented'));
	}
};

exports.Service = Service;