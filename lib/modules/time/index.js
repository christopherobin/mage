var Timer = require('./Timer');

var server = new Timer();


exports.server = server;


exports.now = function (msecOut) {
	return server.now(msecOut);
};


exports.translate = function (timestamp, msecOut) {
	return server.translate(timestamp, msecOut);
};


exports.bend = function (offset, accelerationFactor, startAt) {
	server.configure(offset, accelerationFactor, startAt);
};


exports.unbend = function () {
	server.configure(0, 1, 0);
};


exports.getConfig = function () {
	return {
		offset: server.offset,
		accelerationFactor: server.accelerationFactor,
		startAt: server.startAt
	};
};
