var comm = require('./comm');

exports.comm = comm;

exports.listPeerDependencies = function () {
	return {
		'MMRP ZeroMQ transport': ['zmq']
	};
};


// startup messaging server

exports.setup = function (cb) {
	// Set up comm library

	comm.setup(cb);
};
