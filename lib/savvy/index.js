var path = require('path');
var http = require('http');
var url = require('url');
var fs = require('fs');
var WebSocketServer = require('ws').Server;
var cluster = require('cluster');
var mage = require('../mage');

var logger = mage.core.logger.context('savvy');

mage.core.config.setTopLevelDefault('savvy', path.join(__dirname, '/config.yaml'));

// Maps for routes to HTTP request handlers and websocket handlers

var httpRoutes = {};
var wsRoutes = {};


// Routes will be hooked on to an HTTP server (only running on master).

var httpServer;
var wsServer;

if (cluster.isMaster) {
	httpServer = http.createServer();
	wsServer = new WebSocketServer({ noServer: true });

	// Make sure that this server is cleaned up when mage shuts down.

	httpServer.once('listening', function () {
		process.on('exit', function () {
			httpServer.close();

			try {
				wsServer.close();
			} catch (wsError) {
				logger.error(wsError);
			}
		});
	});
}

/**
 * Simple route adder function. If a route is registered with routeName, then this will be the
 * first element in the path name (so registered functions should expect this). The routeFunction
 * itself should be arity-2, taking node.js request and response objects (in that order);
 *
 * @param {String}   routePath     The path on the HTTP server on which to respond.
 * @param {Function} routeFunction A function that takes node.js request and response objects as arguments.
 */

exports.addRoute = function (routePath, routeFunction) {
	var route = routePath[0] === '/' ? routePath : '/' + routePath;

	if (httpRoutes.hasOwnProperty(route)) {
		logger.error('Route has already been registered:', route);
		return mage.fatalError();
	}

	logger.debug('Added Savvy HTTP route:', route);

	httpRoutes[route] = routeFunction;
};


/**
 * This function creates a new websocket and hooks it on to the existing server object. The
 * websocket server instance is returned so that event listeners can be appended.
 *
 * @param {String}   routePath     The path on the HTTP server on which to respond.
 * @param {Function} routeFunction A function that takes a WebSocket connection object.
 */

exports.addWebSocketRoute = function (routePath, routeFunction) {
	var route = routePath[0] === '/' ? routePath : '/' + routePath;

	if (wsRoutes.hasOwnProperty(route)) {
		logger.error('WebSocket route has already been registered:', route);
		return mage.fatalError();
	}

	logger.debug('Added Savvy WebSocket route:', route);

	wsRoutes[route] = routeFunction;
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
 * @param {Function} callback
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

function hostPortListen(server, port, host, cb) {
	try {
		server.listen(port, host, function (error) {
			if (error) {
				logger.error('Failed to set up savvy server:', error.stack || error.message);
				return cb(error);
			}

			var addr = server.address();
			var resolvedUrl = url.format({ protocol: 'http', hostname: addr.address, port: addr.port });

			logger.notice('Savvy running at:', resolvedUrl);
			return cb();
		});
	} catch (error) {
		cb(error);
	}
}


function urlToRootPath(fullUrl) {
	var pathString = url.parse(fullUrl).pathname;

	// If there was no path (weird), or it did not contain a folder, return undefined.
	if (!pathString || pathString === '/') {
		return;
	}

	// Extract the route from the request path
	// 0th element is empty due to leading '/'. The 1st contains the route name.
	return '/' + pathString.split('/')[1];
}


/**
 * This method came from the ws-library:
 * https://github.com/einaros/ws/blob/master/lib/WebSocketServer.js#L447
 *
 * @param {net.Socket} socket
 * @param {Number} code
 * @param {String} name
 */

function abortConnection(socket, code, name) {
	try {
		var response = [
			'HTTP/1.1 ' + code + ' ' + name,
			'Content-type: text/html'
		];

		socket.write(response.concat('', '').join('\r\n'));
	} catch (e) {
		// ignore errors - we've aborted this connection
	} finally {
		// ensure that an early aborted connection is shut down completely
		try {
			socket.destroy();
		} catch (e) {
			// ignore errors - we've aborted this connection
		}
	}
}


function upgradeHandler(request, socket, head) {
	var route = urlToRootPath(request.url);

	// If there was no route, respond with 404.

	if (!route) {
		logger.warning('No WebSocket route passed');
		return abortConnection(socket, 404, 'Not Found');
	}

	var handler = wsRoutes[route];
	if (!handler) {
		logger.warning('No WebSocket route registered on:', route);
		return abortConnection(socket, 404, 'Not Found');
	}

	logger.debug('Handling savvy WebSocket request');

	wsServer.handleUpgrade(request, socket, head, handler);
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
	var route = urlToRootPath(request.url);

	// If there was no route, respond with 404.
	if (!route) {
		response.statusCode = 404;
		return response.end();
	}

	// If it's a request for a websocket connection, see if we have a handler for that.

	var handler = httpRoutes[route];

	// If there is no registered route for this, respond with 404.
	if (!handler) {
		response.statusCode = 404;
		return response.end();
	}

	// If the route is a webSocket, we can return. The websocket will take care of itself.
	if (handler instanceof WebSocketServer) {
		response.statusCode = 500;
		return response.end();
	}

	// There is a route that we can pass the request and response along to.

	logger.debug('Handling savvy HTTP request');

	handler(request, response);
}


/**
 * The start function makes the savvy HTTP server listen.
 *
 * @param {Function} cb
 */

exports.start = function (cb) {
	if (!httpServer) {
		return cb();
	}

	var bind = mage.core.config.get(['savvy', 'bind']);

	// bind the request handler

	if (httpServer) {
		httpServer.on('request', requestHandler);
		httpServer.on('upgrade', upgradeHandler);
	}

	// The default is a socket file, so host-port configuration gets priority (it implies you are
	// explicity overriding the default socket). If these were the other way around, the savvy.file
	// field would need to be explicitly set to something falsy.

	if (bind && bind.hasOwnProperty('port')) {
		return hostPortListen(httpServer, bind.port, bind.host, cb);
	}

	if (bind && bind.file) {
		return unixSocketListen(httpServer, bind.file, cb);
	}

	// If we got here, then no valid configuration was found. This should NEVER happen, and must be
	// considered an internal server error.

	var error = new Error('Bad configuration. Expected a socket file or host and port to listen on:\n' + JSON.stringify(bind, null, '  '));

	logger.error(error.stack);
	return cb(error);
};

