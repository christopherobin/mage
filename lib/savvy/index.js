var http = require('http');
var url = require('url');
var fs = require('fs');
var WebSocketServer = require('ws').Server;
var cluster = require('cluster');
var mage = require('../mage');

var logger = mage.core.logger.context('savvy');

mage.core.config.setTopLevelDefault('savvy', require('./config.yaml'));

// Workers do not expose the savvy, so we can return now.
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

exports.addRoute = function (routePath, routeFunction) {
	var route = routePath[0] === '/' ? routePath : '/' + routePath;

	if (routes.hasOwnProperty(route)) {
		logger.error('The route ' + route + ' has already been registered.');
		return mage.fatalError();
	}

	routes[route] = routeFunction;
};


/**
 * This function creates a new websocket and hooks it on to the existing server object. The
 * websocket server instance is returned so that event listeners can be appended.
 *
 * @param {String}  routeName Route name without a leading '/'.
 * @return {Object} A websocket server instance.
 */

exports.addWebSocketRoute = function (routePath) {
	var route = routePath[0] === '/' ? routePath : '/' + routePath;

	if (routes.hasOwnProperty(route)) {
		logger.error('The route', route, 'has already been registered.');
		return mage.fatalError();
	}

	routes[route] = new WebSocketServer({ server: server, path: route });
	return routes[route];
};


exports.getBaseUrl = function () {
	var config = mage.core.config;

	return (config.savvy && config.savvy.expose) || null;
};


/**
 * Simple wrapper for setting up a server listening to a unix socket file.
 *
 * @param {Object} server   An http server instance.
 * @param {String} file     A file path for a socket for the server to listen on.
 * @param {String} protocol
 */

function unixSocketListen(server, file, callback) {
	server.listen(file, function (error) {
		if (error) {
			logger.error('Failed to set up savvy server:', error.stack || error.message);
			return callback(error);
		}

		fs.chmod(file, parseInt('777', 8));

		logger.notice('Savvy running on socket:', file);
		return callback();
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

function hostPortListen(server, port, host, callback) {
	server.listen(port, host, function (error) {
		if (error) {
			logger.error('Failed to set up savvy server:', error.stack || error.message);
			return callback(error);
		}

		var resolvedUrl = url.format({ protocol: 'http', hostname: host, port: port });

		logger.notice('Savvy running at:', resolvedUrl);
		return callback();
	});
}


/**
 * Handle HTTP requests to the savvy server. This checks for the requested route, and if it
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
 * Setup makes the savvy HTTP server listen.
 *
 * @param  {Function} callback [description]
 */

exports.setup = function (callback) {
	var config = mage.core.config.savvy;

	// The default is a socket file, so host-port configuration gets priority (it implies you are
	// explicity overriding the default socket). If these were the other way around, the savvy.file
	// field would need to be explicitly set to something falsy.
	if (config && config.bind && config.bind.host && config.bind.hasOwnProperty('port')) {
		return hostPortListen(server, config.bind.port, config.bind.host, callback);
	}

	if (config && config.bind && config.bind.file) {
		return unixSocketListen(server, config.bind.file, callback);
	}

	// If we got here, then no valid configuration was found. This should NEVER happen, and must be
	// considered an internal server error.
	var error = new Error('Bad configuration. Expected a socket file or host and port to listen on:\n' + JSON.stringify(config, null, '  '));

	logger.error(error.stack);
	return callback(error);
};

