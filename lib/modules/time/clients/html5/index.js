// This file has been componentized.
// It is now the time module
//  - /lib/modules/time/component.json
//  - /lib/modules/time/client.js

(function () {

	var mage = window.mage;

	var mod = mage.registerModule($html5client('module.time.construct'));


	var offsetSec = null;	// add this to every client time to get server time
	var offsetMsec = null;	// add this to every client time to get server time


	mod.clientTimeToServerTime = function (timestamp, msec) {
		// clientTime normalized to server time

		return timestamp + (msec ? offsetMsec : offsetSec);
	};


	mod.serverTimeToClientTime = function (timestamp, msec) {
		// serverTime normalized to client time

		return timestamp - (msec ? offsetMsec : offsetSec);
	};


	mod.getClientTime = function (msec) {
		if (msec) {
			return Date.now();
		}

		return (Date.now() / 1000) << 0;	// rounded down
	};


	mod.getServerTime = function (msec) {
		return mod.clientTimeToServerTime(mod.getClientTime(msec), msec);
	};


	mod.synchronize = function (cb) {
		var now = Date.now();

		mod.sync(now, function (error, delta) {
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


	mod.setup = function (cb) {
		mod.synchronize(cb);
	};

}());
