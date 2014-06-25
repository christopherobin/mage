var http = require('http');
var net = require('net');
var url = require('url');
var fs = require('fs');
var WebSocketServer = require('ws').Server;
var cluster = require('cluster');
var mage = require('../mage');
var clientHost = require('../httpServer/transports/http');

clientHost.initialize(mage.core.logger.context('http'));

var BASE_PATH = '/savvy';
var SOCK_PATH = './savvy.sock';
var ROUTE = new RegExp('^' + (BASE_PATH + '/').replace(/\//g, '\\/'));

var logger = mage.core.logger.context('savvy');

// Maps for routes to HTTP request handlers and websocket handlers

var httpServer, httpRoutes = {};
var wsServer, wsRoutes = {};


/**
 * A function to help proxy to get the header that belongs to an HTTP request
 * Once we're on Node 0.12, we'll have access to a more raw representation of headers and trailers,
 * see: https://github.com/joyent/node/commit/e6c81bd67986e672b9b253c62ce6d4a519d3a2e1
 *
 * @param req         The HTTP client request
 * @returns {string}  The generated HTTP request header
 */

function recreateRequestHeader(req) {
	var CRLF = '\r\n';
	var header = req.method + ' ' + req.url + ' HTTP/' + req.httpVersion + CRLF;
	var headerKeys = Object.keys(req.headers);

	for (var i = 0; i < headerKeys.length; i++) {
		var key = headerKeys[i];

		header += key + ': ' + req.headers[key] + CRLF;
	}

	header += CRLF;

	return header;
}


/**
 * A proxy server to route connections from workers into savvy on the master
 *
 * @param {Object} req  The HTTP client request.
 */

function proxy(req) {
	var client = req.connection;
	var savvy;

	client.pause();

	savvy = net.connect(SOCK_PATH, function proxyHandler() {
		logger.debug('Savvy proxy connected');

		// the header has already been consumed, so we must recreate it and send it first

		savvy.write(recreateRequestHeader(req));

		savvy.pipe(client);
		client.pipe(savvy);

		client.resume();
	});

	savvy.on('error', function (error) {
		logger.alert('Proxy error:', error);
	});

	savvy.setTimeout(0);
	savvy.setNoDelay(true);
	savvy.setKeepAlive(true, 0);

	savvy.once('close', function () {
		logger.debug('Proxy closed');
	});

	client.once('close', function () {
		logger.debug('Savvy client closed');
	});
}


function urlToRootPath(fullUrl) {
	var pathString = url.parse(fullUrl).pathname;

	// If there was no path, return undefined.

	if (!pathString || typeof pathString !== 'string') {
		return;
	}

	// Remove Savvy's base route.

	pathString = pathString.replace(ROUTE, '');

	// Remove leading slash.

	while (pathString[0] === '/') {
		pathString = pathString.slice(1);
	}

	// Extract the route from the request path
	// 0th element is the route name.

	return '/' + pathString.split('/')[0];
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
			'content-type: text/html'
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


/**
 * Takes an upgrading connection and hands it off to the websocket server.
 *
 * @param {Object} request
 * @param {net.Socket} socket
 * @param {Buffer} head
 * @returns {*}
 */

function upgradeHandler(request, socket, head) {
	var route = urlToRootPath(request.url);

	// If there was no route, respond with 404.

	if (!route) {
		logger.warning('No WebSocket route passed');
		return abortConnection(socket, 404, 'Not Found');
	}

	var handler = wsRoutes[route];
	if (!handler) {
		logger.warning('No WebSocket route registered on:', request.url);
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
		logger.warning('Could not extract route from HTTP request:', request.url);
		response.statusCode = 404;
		return response.end();
	}

	// If it's a request for a websocket connection, see if we have a handler for that.

	var handler = httpRoutes[route];

	// If there is no registered route for this, respond with 404.
	if (!handler) {
		logger.warning('Route', route, 'is not registered on savvy');
		response.statusCode = 404;
		return response.end();
	}

	// If the route is a webSocket, we can return. The websocket will take care of itself.
	if (handler instanceof WebSocketServer) {
		response.statusCode = 500;
		return response.end();
	}

	// There is a route that we can pass the request and response along to.

	logger.debug('Handling savvy HTTP request to', route);

	handler(request, response);
}


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
			logger.emergency('Failed to set up savvy server:', error);
			return callback(error);
		}

		fs.chmod(file, parseInt('777', 8));

		logger.notice('Savvy running on socket:', file);
		return callback();
	});
}


// Cluster masters listen on a socket file

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


// Non-masters proxy requests to the master process. This means that in single-node mode, we have
// a registered route on the clientHost, AND a socket file we listen on. Both may be accessed by
// the outside world, depending on the environment. In the future, we can likely change the
// single-node mode to no longer expose a socket file, and simply stick to using clientHost.

if (!mage.core.processManager.isMaster) {
	clientHost.server.on('upgrade', function (req, socket) {
		if (!req.url.match(ROUTE)) {
			logger.error('Upgrade request is not for savvy:', req.url);
			return socket.destroy();
		}

		if (req.method !== 'GET' && req.headers.upgrade.toLowerCase() !== 'websocket') {
			logger.error('Upgrade request is not a websocket type:', req.headers.upgrade);
			return socket.destroy();
		}

		socket.setTimeout(0);
		socket.setNoDelay(true);
		socket.setKeepAlive(true, 0);

		proxy(req);
	});

	if (cluster.isMaster) {
		// single node mode

		clientHost.addRoute(ROUTE, requestHandler, true);
	} else {
		// worker in cluster

		clientHost.addRoute(ROUTE, proxy, true);
	}
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


exports.getBaseUrl = function (headers) {
	return clientHost.getClientHostBaseUrl(headers) + BASE_PATH;
};


/**
 * The start function makes the savvy HTTP server listen.
 *
 * @param {Function} cb
 */

exports.start = function (cb) {
	if (!httpServer) {
		return cb();
	}

	// bind the request handler

	httpServer.on('request', requestHandler);
	httpServer.on('upgrade', upgradeHandler);

	unixSocketListen(httpServer, SOCK_PATH, cb);
};
