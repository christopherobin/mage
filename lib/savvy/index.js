var path = require('path');
var http = require('http');
var url = require('url');
var fs = require('fs');
var WebSocketServer = require('ws').Server;
var cluster = require('cluster');
var mage = require('../mage');

var logger = mage.core.logger.context('savvy');

mage.core.config.setTopLevelDefault('savvy', path.join(__dirname, '/config.yaml'));

// The routes object will contain registered routes from other libraries.
var routes = {};

// Routes will be hooked on to an HTTP server (only running on master).

var server;

if (cluster.isMaster) {
	server = http.createServer();

	// Make sure that this server is cleaned up when mage shuts down.

	server.once('listening', function () {
		mage.once('shutdown', function () {
			server.close();
		});
	});
}

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
		logger.error('Route has already been registered:', route);
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
	if (!server) {
		logger.error('No HTTP server set up.');
		return mage.fatalError();
	}

	var route = routePath[0] === '/' ? routePath : '/' + routePath;

	if (routes.hasOwnProperty(route)) {
		logger.error('Route has already been registered:', route);
		return mage.fatalError();
	}

	routes[route] = new WebSocketServer({ server: server, path: route });
	return routes[route];
};


exports.getBaseUrl = function () {
	var expose = mage.core.config.get(['savvy', 'expose']);
	if (!expose) {
		return null;
	}

	// The base URL may be an object or a string. If it's an object, we need to format it.
	if (typeof expose !== 'string') {
		var urlObject = {
			protocol: 'http',
			hostname: expose.host || 'localhost',
			port: expose.port,
			pathname: expose.path
		};

		if (expose.authUser && expose.authPass) {
			urlObject.auth = expose.authUser + ':' + expose.authPass;
		}

		expose = url.format(urlObject);
	}

	// If there is a trailing slash, remove it.
	return expose.slice(-1) === '/' ? expose.slice(0, -1) : expose;
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
 * @param {Function} callback
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
	var route = routes['/' + pathArray[1]];

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


/**
 * Setup makes the savvy HTTP server listen.
 *
 * @param {Function} callback
 */

exports.setup = function (callback) {
	if (!server) {
		return callback();
	}

	var bind = mage.core.config.get(['savvy', 'bind']);

	// bind the request handler

	server.on('request', requestHandler);

	// The default is a socket file, so host-port configuration gets priority (it implies you are
	// explicity overriding the default socket). If these were the other way around, the savvy.file
	// field would need to be explicitly set to something falsy.

	if (bind && bind.host && bind.hasOwnProperty('port')) {
		return hostPortListen(server, bind.port, bind.host, callback);
	}

	if (bind && bind.file) {
		return unixSocketListen(server, bind.file, callback);
	}

	// If we got here, then no valid configuration was found. This should NEVER happen, and must be
	// considered an internal server error.

	var error = new Error('Bad configuration. Expected a socket file or host and port to listen on:\n' + JSON.stringify(bind, null, '  '));

	logger.error(error.stack);
	return callback(error);
};

