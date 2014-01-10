var offsetSec = 0;   // add this to every client time to get server time
var offsetMsec = 0;  // add this to every client time to get server time

/**
 * Returns the difference in msec between server and client
 *
 * @returns {number} milliseconds difference
 */

exports.getOffset = function () {
	return offsetMsec;
};


/**
 * Converts a timestamp from this device to one that is synchronized with the server
 *
 * @param {number}  timestamp   client-side timestamp
 * @param {boolean} msec        whether the given timestamp is milliseconds or not
 * @returns {number}            timestamp normalized to the server's clock
 */

exports.clientTimeToServerTime = function (timestamp, msec) {
	return timestamp + (msec ? offsetMsec : offsetSec);
};


/**
 * Converts a server-side timestamp to one that is synchronized with this device
 *
 * @param {number}  timestamp  server-side timestamp
 * @param {boolean} msec       whether the given timestamp is milliseconds or not
 * @returns {number}           timestamp normalized to the client's clock
 */

exports.serverTimeToClientTime = function (timestamp, msec) {
	return timestamp - (msec ? offsetMsec : offsetSec);
};

/**
 * Returns the current time on this device
 *
 * @param {boolean} msec  whether to return the time in milliseconds
 * @returns {number}      time on this device
 */

exports.getClientTime = function (msec) {
	if (msec) {
		return Date.now();
	}

	return Math.floor(Date.now() / 1000);
};


/**
 * Returns the current time on the server
 *
 * @param {boolean} msec  whether to return the time in milliseconds
 * @returns {number}      time on the server
 */

exports.getServerTime = function (msec) {
	return exports.clientTimeToServerTime(exports.getClientTime(msec), msec);
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

	var now = Date.now();

	exports.sync(now, function (error, delta) {
		if (error) {
			return cb(error);
		}

		offsetMsec = delta;
		offsetSec = Math.floor(delta / 1000);

		cb();
	});
};

exports.setup = function (cb) {
	exports.synchronize(cb);
};
