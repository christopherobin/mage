var requirePeer = require('codependency').get('mage');

var zmq = requirePeer('zmq');


module.exports = function (cfg, identity) {
	if (!cfg || !cfg.port) {
		throw new Error('Router bindings incomplete ("host" is optional, "port" is required)');
	}

	var routerUri = 'tcp://' + (cfg.host || '*') + ':' + cfg.port;

	var router = zmq.createSocket('router');

	if (identity) {
		router.identity = identity;
	}

	// Normally, a router will drop messages, which would make our handshake etc fail if the
	// endpoint has not established a connection to our router yet. For this reason, we set
	// ZMQ_ROUTER_MANDATORY, which throws an error during send() when a route is not accessible.

	router.setsockopt(zmq.ZMQ_ROUTER_MANDATORY, 1);

	try {
		router.bindSync(routerUri);
	} catch (error) {
		if (error.code === 'EADDRINUSE' || error.message === 'Address already in use') {
			// strange, but: sometimes e.code is set, sometimes e.message

			var cmd;
			var m = routerUri.match(/^[a-z]+:\/\/(.+)$/);

			if (m) {
				cmd = 'netstat -lpn |grep "' + m[1] + '"';
			} else {
				cmd = 'netstat -lp';
			}

			throw new Error('router.bindSync() failed, address already in use. Analyze with: ' + cmd);
		}

		if (cfg.port === '*' && error.message === 'Invalid argument') {
			// NOTE: When this error occurs, it is trickled down straight form C land and not
			// wrapped or handled along the way. This results in a non error object error, with only
			// a "message" property. As such no other means currently exist to detect it. This needs
			// to be fixed within the zeromq module.

			throw new Error(
				'router.bindSync() failed, please install zeromq 3.0.0+ for wildcard ports support ' +
				'(current version: ' + exports.zmqVersion + ').'
			);
		}

		throw error;
	}

	return router;
};

