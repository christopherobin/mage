var Timer = require('./Timer');

var timer = exports.timer = new Timer();


exports.now = function (msecOut) {
	return timer.now(msecOut);
};


exports.translate = function (timestamp, msecOut) {
	return timer.translate(timestamp, msecOut);
};


exports.bend = function (offset, accelerationFactor, startAt) {
	timer.configure(offset, accelerationFactor, startAt);
};


exports.unbend = function () {
	timer.configure(0, 1, 0);
};


exports.getConfig = function () {
	return {
		offset: timer.offset,
		accelerationFactor: timer.accelerationFactor,
		startAt: timer.startAt
	};
};
