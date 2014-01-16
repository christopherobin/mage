var Timer = require('./Timer');

var server = exports.server = new Timer();
var client = exports.client = new Timer();


/**
 * Returns the difference in msec between server and client
 *
 * @returns {number} milliseconds difference
 */

exports.getOffset = function () {
	return client.offset - server.offset;
};


/**
 * Converts a timestamp from this device to one that is synchronized with the server
 *
 * @param {number}  timestamp   client-side timestamp
 * @param {boolean} msecOut     whether the given timestamp is milliseconds or not
 * @returns {number}            timestamp normalized to the server's clock
 */

exports.clientTimeToServerTime = function (timestamp, msecOut) {
	return server.translate(timestamp, msecOut);
};


/**
 * Converts a server-side timestamp to one that is synchronized with this device
 *
 * @param {number}  timestamp  server-side timestamp
 * @param {boolean} msecOut    whether the given timestamp is milliseconds or not
 * @returns {number}           timestamp normalized to the client's clock
 */

exports.serverTimeToClientTime = function (timestamp, msecOut) {
	return client.translate(timestamp, msecOut);
};

/**
 * Returns the current time on this device
 *
 * @param {boolean} msecOut  whether to return the time in milliseconds
 * @returns {number}         time on this device
 */

exports.getClientTime = function (msecOut) {
	return client.now(msecOut);
};


/**
 * Returns the current time on the server
 *
 * @param {boolean} msecOut  whether to return the time in milliseconds
 * @returns {number}      time on the server
 */

exports.getServerTime = function (msecOut) {
	return server.now(msecOut);
};


// alias to match server behavior

exports.now = exports.getServerTime;


/**
 * Synchronizes the client clock with the server clock.
 *
 * @param {Function} cb   called on completion
 */

exports.synchronize = function (cb) {
	cb = cb || function () {};

	if (!exports.hasOwnProperty('sync')) {
		return cb(new Error('time.sync usercommand is not exposed.'));
	}

	exports.sync(Date.now(), function (error, config) {
		if (error) {
			return cb(error);
		}

		// positive delta: browser time is ahead of server time
		// negative delta: server time is ahead of browser time

		// Time according to server

		server.configure(
			config.timer.offset - config.delta,   // server time is browser time + configured offset - delta
			config.timer.accelerationFactor,
			config.timer.startAt + config.delta   // acceleration starts at server startTime + delta
		);

		// Time according to client (different delta, same time bending rules)

		client.configure(
			config.timer.offset,                  // browser time is browser time + configured offset
			config.timer.accelerationFactor,
			config.timer.startAt + config.delta   // acceleration starts at server startTime + delta
		);

		cb();
	});
};


exports.setup = function (cb) {
	exports.synchronize(cb);
};
