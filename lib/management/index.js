var http = require('http');
var url = require('url');
var fs = require('fs');
var WebSocketServer = require('ws').Server;
var cluster = require('cluster');
var mage = require('../mage');

var logger = mage.core.logger.context('management');

mage.core.config.setTopLevelDefault('management', require('./config.yaml'));

// Workers do not expose the management interface, so we can return now.
if (cluster.isWorker) {
	return;
}

// The routes object will contain registered routes from other libraries.
var routes = {};

// Routes will be hooked on to an HTTP server. 
var server = http.createServer();

// Make sure that this server is cleaned up when mage shuts down.
server.once('listening', function () {
	mage.once('shutdown', function () {
		server.close();
	});
});


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
 * This function creates a new websocket and hooks it on to the existing server object. The
 * websocket server instance is returned so that event listeners can be appended.
 *
 * @param {String}  routeName Route name without a leading '/'.
 * @return {Object} A websocket server instance.
 */

exports.addWebSocketRoute = function (routeName) {
	if (routes.hasOwnProperty(routeName)) {
		logger.error('The route', name, 'has already been registered.');
		return mage.fatalError();
	}

	routes[routeName] = new WebSocketServer({ server: server, path: '/' + routeName });
	return routes[routeName];
};


/**
 * Simple wrapper for setting up a server listening to a unix socket file.
 *
 * @param {Object} server   An http server instance.
 * @param {String} file     A file path for a socket for the server to listen on.
 * @param {String} protocol
 */

function unixSocketListen(server, file) {
	server.listen(file, function (error) {
		if (error) {
			logger.error(error);
			return mage.fatalError();
		}

		fs.chmod(file, parseInt('777', 8));

		logger.notice('Management interfaces running on socket:', file);
	});
}


/**
 * Simple wrapper for setting up a server listening on a port.
 *
 * @param {Object} server   An http server instance.
 * @param {Number} port     A port for the server to listen on.
 * @param {String} host     A hostname for the server.
 * @param {String} protocol
 */

function hostPortListen(server, port, host) {
	server.listen(port, host, function (error) {
		if (error) {
			logger.error(error);
			return mage.fatalError();
		}

		var resolvedUrl = url.format({ protocol: 'http', hostname: host, port: port });

		logger.notice('Management interfaces running at:', resolvedUrl);
	});
}


/**
 * Handle HTTP requests to the management server. This checks for the requested route, and if it
 * exists passes the request and response objects to it. If the path is not resolved, then a 404
 * is sent.
 *
 * @param {Object} request  HTTP request object.
 * @param {Object} response HTTP response object.
 */

function requestHandler(request, response) {
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

	// If the route is a webSocket, we can return. The websocket will take care of itself.
	if (route instanceof WebSocketServer) {
		response.statusCode = 500;
		return response.end();
	}

	// There is a route that we can pass the request and response along to.
	route(request, response);
}

server.on('request', requestHandler);


/**
 * Setup makes the management HTTP server listen.
 *
 * @param  {Function} callback [description]
 */

exports.setup = function (callback) {
	var config = mage.core.config.management;

	// The default is a port, so host-port configuration gets priority (it implies you are explicity
	// overriding the default socket). If these were the other way around, the management.file field
	// would need to be explicitly set to something falsy.
	if (config && config.host && config.hasOwnProperty('port')) {
		hostPortListen(server, config.port, config.host);
		return callback();
	}

	if (config && config.file) {
		unixSocketListen(server, config.file);
		return callback();
	}

	// If we got here, then no valid configuration was found.
	var message = 'Bad configuration. Expected a socket file or host and port to listen on: ' + config;

	logger.error(message);
	callback(new Error(message));
};

