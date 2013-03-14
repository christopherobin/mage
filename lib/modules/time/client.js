var offsetSec = null;	// add this to every client time to get server time
var offsetMsec = null;	// add this to every client time to get server time

exports.clientTimeToServerTime = function (timestamp, msec) {
	// clientTime normalized to server time

	return timestamp + (msec ? offsetMsec : offsetSec);
};


exports.serverTimeToClientTime = function (timestamp, msec) {
	// serverTime normalized to client time

	return timestamp - (msec ? offsetMsec : offsetSec);
};


exports.getClientTime = function (msec) {
	if (msec) {
		return Date.now();
	}

	return (Date.now() / 1000) << 0;	// rounded down
};


exports.getServerTime = function (msec) {
	return exports.clientTimeToServerTime(exports.getClientTime(msec), msec);
};


exports.synchronize = function (cb) {
	var now = Date.now();

	exports.sync(now, function (error, delta) {
		if (error) {
			return cb(error);
		}

		offsetMsec = delta;
		offsetSec = (delta / 1000) << 0;	// rounded down

		console.log('Client/server time delta is', delta, 'msec.');

		if (cb) {
			cb();
		}
	});
};

exports.setup = function (cb) {
	exports.synchronize(cb);
};
