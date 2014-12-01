var assert = require('assert');
var net = require('net');


/**
 * Opens a connection to the HTTP server that could prevent a graceful shutdown. Returns the moment we know we have a
 * connection established.
 *
 * @param {Object} project
 * @param {Function} cb
 */

function stallingHttpClientConnection(project, cb) {
	var httpServer = project.mage.core.httpServer;
	var address = httpServer.server.address();

	var socket = net.connect({ host: address.address, port: address.port });

	socket.on('connect', function () {
		socket.write(
			'GET /stallforever HTTP/1.1\r\n' +
			'Host: ' + address.address + ':' + address.port + '\r\n' +
			'Connection: close\r\n' +
			'\r\n'
		);

		cb();
	});

	socket.on('data', function () {
		assert.fail('Stall forever actually returned data');
	});

	socket.on('end', function () {
		assert.fail('Stall forever actually closed successfully');
	});
}


module.exports = function (project, cb) {
	stallingHttpClientConnection(project, cb);
};
