var http = require('http');
var url = require('url');
var fs = require('fs');
var cluster = require('cluster');
var mage = require('../mage');
var logger = mage.core.logger.context('management');
var config = mage.core.config;

// The routes object will contain registered routes from other libraries.
var routes = {};

config.setTopLevelDefault('management', require('./config.yaml'));

// Workers do not expose the management interface.
if (cluster.isWorker) {
	return;
}

// Config looks like:
// management:
//     protocol: http
//     file: ./management.sock
//     # or
//     host: a.b.com
//     port: 1234

/**
 * Simple route adder function. If a route is registered with routeName, then this will be the
 * first element in the path name (so registered functions should expect this). The routeFunction
 * itself should be arity-2, taking node.js request and response objects (in that order);
 *
 * @param {String}   routeName     The name of this route.
 * @param {Function} routeFunction A function that takes node.js request and response objects as arguments.
 */

exports.addRoute = function (routeName, routeFunction) {
	if (routes.hasOwnProperty(routeName)) {
		logger.error('The route ' + routeName + ' has already been registered.');
		return mage.fatalError();
	}

	routes[routeName] = routeFunction;
};



/**
 * Simple wrapper for setting up a server listening to a unix socket file.
 *
 * @param {Object} server
 * @param {String} file
 * @param {String} protocol
 */

function unixSocketListen(server, file, protocol) {
	server.listen(file, function (error) {
		if (error) {
			logger.error(error);
			return mage.fatalError();
		}

		var pseudoUrl = url.format({ protocol: protocol, slashes: true, hostname: file });

		fs.chmod(file, parseInt('777', 8));

		logger.notice('Management interfaces running at:', pseudoUrl);
	});
}


/**
 * Simple wrapper for setting up a server listening on a port.
 *
 * @param {Object} server
 * @param {Number} port
 * @param {String} host
 * @param {String} protocol
 */

function hostPortListen(server, port, host, protocol) {
	server.listen(port, host, function (error) {
		if (error) {
			logger.emergency(error);
			return mage.fatalError();
		}

		var resolvedUrl = url.format({ protocol: protocol, hostname: host, port: port });

		logger.notice('Management interfaces running at:', resolvedUrl);
	});
}


var server = http.createServer();

server.on('request', function (request, response) {
	var pathString = url.parse(request.url).pathname;

	// If there was no path (weird) or no route, respond with 404.
	if (!pathString || pathString === '/') {
		response.statusCode = 404;
		return response.end();
	}

	// Split the path into parts.
	var pathArray = pathString.split('/');

	// 0th element is empty due to leading '/'. The 1st contains the route name.
	var route = routes[pathArray[1]];

	// If there is no registered route for this, respond with 404.
	if (!route) {
		response.statusCode = 404;
		return response.end();
	}

	// There is a route that we can pass the request and response along to.
	route(request, response);
});

// Make sure that this server is cleaned up when mage shuts down.
server.once('listening', function () {
	mage.once('shutdown', function () {
		server.close();
	});
});

if (!config.management || typeof config.management !== 'object' || !config.management.protocol) {
	logger.error('Bad configuration. Expected top level management object, but found: ' + JSON.stringify(config.management));
	return mage.fatalError(); // TODO
}

config = config.management;

if (config.hasOwnProperty('file')) {
	unixSocketListen(server, config.file, config.protocol);
	return;
}

if (config.hasOwnProperty('host') && config.hasOwnProperty('port')) {
	hostPortListen(server, config.port, config.host, config.protocol);
	return;
}

logger.error('Bad configuration. Expected a socket file or host and port to listen on: ', config);
mage.fatalError();
