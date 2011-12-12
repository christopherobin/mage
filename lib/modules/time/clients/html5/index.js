(function () {

	var mithril = window.mithril;

	var mod = mithril.registerModule($html5client('module.time.construct'));


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
		var start = Date.now();

		mod.sync(function (error, serverTime) {
			if (error) {
				return cb(error);
			}

			var end = Date.now();
			var delay = (end - start) >> 1;	// total delay taken into account, is half the duration of this user command

			serverTime += delay;	// advance the server time by half the duration of the user command

			var now = Date.now();

			offsetMsec = serverTime - now;
			offsetSec = (offsetMsec / 1000) << 0;	// rounded down

			console.log('Time synchronize took', end - start, 'msec, advanced server time by', delay, 'msec. Final offset:', offsetMsec, 'msec.');

			if (cb) {
				cb();
			}
		});
	};


	mod.setup = function (cb) {
		mod.synchronize(cb);
	};

}());
