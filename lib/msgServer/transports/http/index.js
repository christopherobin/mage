var http = require('http');
var url = require('url');
var zlib = require('zlib');
var WebSocketServer = require('ws').Server;
var fs = require('fs');
var pathJoin = require('path').join;
var pathResolve = require('path').resolve;
var pathRelative = require('path').relative;
var proxy = require('./proxy.js');
var HttpRouter = require('./HttpRouter.js');
var logger;


exports.initialize = function (mageLogger) {
	logger = mageLogger;
};

var server, wsServer;
var cors;  // cors configuration object
var isListening = false;


function sendHttpResponse(res, statusCode, headers, body) {
	if (!headers) {
		headers = {};
	}

	// some clients (iOS6) cache even post responses
	// aggressively disable all caching

	headers.pragma = 'no-cache';

	res.writeHead(statusCode, headers);

	if (body) {
		res.end(body);
	} else {
		res.end();
	}
}


function shouldDecompress(req, resHeaders) {
	// output is not gzipped

	if (!resHeaders || resHeaders['content-encoding'] !== 'gzip') {
		return false;
	}

	// no encodings will be accepted

	var accepts = req.headers['accept-encoding'];
	if (!accepts) {
		return true;
	}

	// gzip unsupported

	if ((',' + accepts + ',').indexOf(',gzip,') === -1) {
		return true;
	}

	// gzip supported

	return false;
}


function sendDecompressedHttpResponse(res, statusCode, headers, body) {
	// uncompress, then send

	zlib.gunzip(body, function (error, uncompressed) {
		if (error) {
			logger.error('Failed to decompress output for client:', error);

			return sendHttpResponse(res, 500, headers);  // 500: Internal server error
		}

		// clone the headers (so we don't affect the original), but leave out content-encoding

		var newHeaders = {};
		var keys = Object.keys(headers);

		for (var i = 0; i < keys.length; i += 1) {
			var key = keys[i];

			if (key !== 'content-encoding') {
				newHeaders[key] = headers[key];
			}
		}

		logger.warning('Decompressed GZIP encoded content for client without support.');

		return sendHttpResponse(res, statusCode, newHeaders, uncompressed);
	});
}


// HTTP route handling

var routers = {
	http: new HttpRouter(['simple', 'callback', 'proxy']),
	websocket: new HttpRouter(['websocket', 'proxy'])
};


function createSimpleHandler(fn) {
	return function (req, res, path, urlInfo) {
		fn(req, res, path, urlInfo.query, urlInfo);
	};
}

function createCallbackHandler(fn) {
	return function (req, res, path, urlInfo) {
		fn(req, path, urlInfo.query, function (httpCode, out, headers) {
			if (httpCode === false) {
				// internal server error

				httpCode = 500;

				logger.critical.data(req).log('Internal server error during HTTP request:', path);
			} else {
				logger.info.data(req).log('Completed HTTP request:', path);
			}

			// There's a chance that something was cached while compressed, and this client
			// does not support compression. In that case, we decompress on the fly.

			if (shouldDecompress(req, headers)) {
				sendDecompressedHttpResponse(res, httpCode, headers, out);
			} else {
				sendHttpResponse(res, httpCode, headers, out);
			}
		});
	};
}

function createWebSocketHandler(fn) {
	return function (client, urlInfo) {
		fn(client, urlInfo);
	};
}


function createProxyHandler(fn) {
	// a proxy handler must return an endpoint string, which it may do based on the incoming request
	// the format of the endpoint is { host: '', port: 123 } or { path: './foo.sock' }

	return function (req, urlInfo) {
		var endpoint = fn(req, urlInfo);

		var socket = proxy(req, endpoint);

		socket.on('connect', function () {
			logger.verbose('Proxy socket for', urlInfo.pathname, 'to', endpoint, 'connected.');
		});

		socket.on('close', function () {
			logger.verbose('Proxy socket for', urlInfo.pathname, 'to', endpoint, 'closed.');
		});

		socket.on('error', function (error) {
			logger.error('Connection error while proxying', urlInfo.pathname, 'to', endpoint, error);
		});
	};
}


/**
 * @param {string|RegExp} pathMatch
 * @param {Function}      fn
 * @param {string}        type
 */

exports.addRoute = function (pathMatch, fn, type) {
	// supported types: callback, simple, websocket, proxy
	// for backwards compatibility, undefined will map to "callback", and boolean true to "simple".

	if (type === undefined) {
		type = 'callback';
	} else if (type === true) {
		type = 'simple';
	}

	var handler;

	switch (type) {
	case 'simple':
		handler = createSimpleHandler(fn);
		routers.http.add(pathMatch, handler, type);
		break;
	case 'callback':
		handler = createCallbackHandler(fn);
		routers.http.add(pathMatch, handler, type);
		break;
	case 'websocket':
		handler = createWebSocketHandler(fn);
		routers.websocket.add(pathMatch, handler, type);
		break;
	case 'proxy':
		handler = createProxyHandler(fn);
		routers.http.add(pathMatch, handler, type);
		routers.websocket.add(pathMatch, handler, type);
		break;
	default:
		throw new Error('Unknown route handler type: ' + type);
	}

	logger.verbose('Added', type, 'route:', pathMatch);
};


exports.delRoute = function (pathMatch) {
	routers.http.del(pathMatch);
	routers.websocket.del(pathMatch);

	logger.verbose('Removed route:', pathMatch);
};


exports.setFavicon = function (buffer, mimetype) {
	var headers = {
		'content-type': mimetype || 'image/x-icon',
		'content-length': buffer.length
	};

	exports.addRoute('/favicon.ico', function (req, path, params, cb) {
		logger.debug('Serving favicon.ico');

		cb(200, buffer, headers);
	});
};


exports.enableDefaultFavicon = function () {
	// the mage logo

	var defaultFaviconBuff = new Buffer(
		'AAABAAEAEBAAAAAAAABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAA' +
		'AAD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//' +
		'/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//' +
		'/wD///8A////AAAAAAAAAAAAJB3uFCQd7iAkHe4oJB3uayQd7uEkHe78JB3u6yQd7sQkHe6HJB3uLwAA' +
		'AAAAAAAAAAAAAAAAAAAkHe51JB3u6iQd7v8kHe7/JB3u/yQd7t4kHe6pJB3u/yQd7v8kHe7/JB3u/yQd' +
		'7v8kHe61JB3uHQAAAAAAAAAAJB3uASQd7mMkHe76JB3u/yQd7v8kHe7/JB3u/yQd7v8kHe7/JB3u7iQd' +
		'7tEkHe7/JB3u/yQd7uskHe4tAAAAAAAAAAAmNe4JJjXukSY17v8mNe7/JjXu/yY17v8mNe6zJjXurSY1' +
		'7oImNe4+JjXuyCY17oAmNe7/JjXu5yY17hUoTe8DKE3vaShN7/EoTe//KE3v/yhN7/8oTe//KE3vuAAA' +
		'AAAoTe8EKE3vBwAAAAAoTe9eKE3v/yhN7/8oTe+SAAAAAAAAAAArXfEvK13x9Ctd8f8rXfH/K13xVytd' +
		'8RUrXfFIK13x/ytd8f8rXfHGK13xAytd8S0rXfHfK13x5wAAAAAAAAAAAAAAAC1u82otbvP/LW7z/y1u' +
		'8/oAAAAALW7ziC1u8/8tbvP/LW7z/y1u8wItbvOcLW7z/y1u8/8AAAAAAAAAAAAAAAAve/UFL3v16i97' +
		'9f8ve/ViAAAAAC979Vwve/X/L3v1/y979eEAAAAAL3v1Hi979dsve/XwAAAAAAAAAAAAAAAAAAAAADOI' +
		'9XsziPX/M4j19jOI9bEAAAAAM4j1FjOI9RsziPUGM4j1UjOI9f8ziPX/M4j1pgAAAAAAAAAAAAAAAAAA' +
		'AAA4lfcIOJX3zDiV9/84lfeqOJX3fTiV92M4lfcpOJX3nziV92I4lff/OJX39jiV9ycAAAAAAAAAAAAA' +
		'AAAAAAAAAAAAADuj+RU7o/nGO6P5/zuj+f87o/nrO6P5rjuj+f87o/n/O6P58juj+UkAAAAAAAAAAAAA' +
		'AAAAAAAAAAAAAAAAAAAAAAAAQbD7BUGw+2hBsPvGQbD7+EGw+/9BsPvhQbD7k0Gw+x0AAAAAAAAAAP//' +
		'/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//' +
		'/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//' +
		'/wD///8A//8AAP//AAD8HwAAgAcAAMADAADAIQAAwPgAAOOMAADxCAAA84wAAPj4AAD46QAA/AMAAP8H' +
		'AAD//wAA//8AAA==', 'base64');

	exports.setFavicon(defaultFaviconBuff);
};


exports.serveFile = function (route, filePath, errorHandler) {
	if (!errorHandler) {
		errorHandler = function (error) {
			logger.error
				.data('filePath', filePath)
				.data('error', error)
				.log('Error while serving', route);
		};
	}

	exports.addRoute(route, function (req, res) {
		var stream;

		try {
			stream = fs.createReadStream(filePath);
		} catch (error) {
			res.writeHead(500);
			res.end();

			return errorHandler(error);
		}

		stream.on('open', function () {
			stream.pipe(res);
		});

		stream.on('error', function (error) {
			if (error.code === 'ENOENT') {
				res.writeHead(404);
			} else {
				res.writeHead(500);
			}

			res.end();

			return errorHandler(error);
		});
	}, 'simple');
};


exports.enableCheckTxt = function (folder) {
	var filePath = pathJoin(folder, 'check.txt');

	exports.serveFile('/check.txt', filePath, function (error) {
		logger.error
			.data('filePath', filePath)
			.data('error', error)
			.log('Error while serving check.txt. Please address this to allow services to monitor your application status.');
	});
};


// HTTP request handling

function requestHandler(req, res) {
	logger.debug('Received HTTP', req.method, 'request:', req.url);

	var urlInfo = url.parse(req.url, true, true);

	// get the route handler

	var path = decodeURIComponent(urlInfo.pathname);
	var route = routers.http.get(path);

	// if no handler was found for this route, return: 404 Not found

	if (!route) {
		logger.warning.data(req).log('No route has been registered for this HTTP request (404)');
		res.writeHead(404);
		res.end();
		return;
	}

	// if the route is supposed to proxy the request elsewhere, do it now

	if (route.type === 'proxy') {
		route.handler(req, urlInfo);
		return;
	}

	// support cross-origin requests
	// see: https://developer.mozilla.org/en/docs/HTTP/Access_control_CORS

	if (cors) {
		res.setHeader('Access-Control-Allow-Origin', cors.origin);

		if (cors.credentials) {
			res.setHeader('Access-Control-Allow-Credentials', 'true');
		}
	}

	if (req.method === 'OPTIONS') {
		// This is usually a CORS related preflight scenario, where the browser is trying to figure
		// out if the real (to follow) request will actually be allowed by our server.

		if (cors) {
			// preflight-only cors headers

			res.setHeader('Access-Control-Allow-Methods', cors.methods);

			if (req.headers['access-control-request-headers']) {
				res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers']);
			}
		}

		return sendHttpResponse(res, 200, { 'content-length': 0 });
	}

	// execute the handler

	var reqStart = Date.now();

	function complainAboutLongRequest() {
		var duration = Date.now() - reqStart;
		if (duration > 500) {
			logger.warning(req.url, 'completed in', Date.now() - reqStart, 'msec');
		}
	}

	res.once('finish', complainAboutLongRequest);

	logger.verbose('Following HTTP route', route.matcher);

	route.handler(req, res, path, urlInfo);
}


/**
 * This method came from the ws-library:
 * https://github.com/einaros/ws/blob/master/lib/WebSocketServer.js#L447
 *
 * @param {net.Socket} socket
 * @param {number} code
 * @param {string} name
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


function upgradeHandler(req, socket, head) {
	logger.debug('Received HTTP upgrade request:', req.url);

	// test if this is for a websocket or not

	if (req.method !== 'GET' && req.headers.upgrade.toLowerCase() !== 'websocket') {
		logger.error.data(req).log('Upgrade request is not a websocket type:', req.headers.upgrade);

		return abortConnection(socket, 400, 'Bad Request');
	}

	var urlInfo = url.parse(req.url, true, true);

	var path = decodeURIComponent(urlInfo.pathname);
	var route = routers.websocket.get(path);

	if (!route) {
		logger.warning.data(req).log('No route has been registered for this WebSocket request (404)');

		return abortConnection(socket, 404, 'Not Found');
	}

	// set some good defaults for websocket connections

	socket.setTimeout(0);
	socket.setNoDelay(true);
	socket.setKeepAlive(true, 0);

	// if the route is supposed to proxy the request elsewhere, do it now

	if (route.type === 'proxy') {
		route.handler(req, urlInfo);
		return;
	}

	// only websocket routes can pick up this request now

	if (route.type !== 'websocket') {
		logger.warning.data(req).log('The handler registered on this route is not for websockets (404)');

		return abortConnection(socket, 400, 'Bad Request');
	}

	// handle the upgrade and pass the connection to the route handler

	wsServer.handleUpgrade(req, socket, head, function (client) {
		route.handler(client, urlInfo);
	});
}


// server creation and event handling

server = http.createServer();
wsServer = new WebSocketServer({ noServer: true });


server.on('request', requestHandler);
server.on('upgrade', upgradeHandler);

server.on('listening', function () {
	isListening = true;
});

server.on('close', function () {
	isListening = false;
	logger.notice('HTTP server closed');
});

server.on('error', function () {
	// on error, sockets are automatically closed
	isListening = false;
});


// functions for listening on port or socket file

function bindToFile(filePath, cb) {
	// resolve the path and shorten it to avoid long-path bind errors

	filePath = pathRelative(process.cwd(), pathResolve(filePath));

	function callback(error) {
		server.removeListener('error', callback);

		if (error) {
			if (error.code === 'EADDRINUSE') {
				error.message =
					filePath + ' already exists. Perhaps the server did not shut down ' +
					'cleanly. Try removing the file and starting again. (' + error.code + ')';
			} else {
				error.message = 'Error while binding to ' + filePath + ' (' + error.code + ')';
			}

			return cb(error);
		}

		logger.notice('HTTP Server bound to', filePath);

		return cb();
	}

	// listen() can throw, despite the error listener
	// this happens in cluster mode if the stdio channels have been closed by the master

	server.on('error', callback);

	try {
		server.listen(filePath, function (error) {
			if (error) {
				return callback(error);
			}

			fs.chmod(filePath, parseInt('777', 8), callback);
		});
	} catch (error) {
		// listen() can throw, despite the error listener
		// this happens in cluster mode if the stdio channels have been closed by the master

		setImmediate(function () {
			callback(error);
		});
	}
}


function bindToPort(port, host, cb) {
	function callback(error) {
		server.removeListener('error', callback);

		var boundAddress = (host || 'INADDR_ANY') + ':' + port;

		if (error) {
			if (error.code === 'EADDRINUSE') {
				error.message = 'Address ' + boundAddress + ' is already in use (' + error.code + ')';
			} else {
				error.message = 'Error while binding to ' + boundAddress + ' (' + error.code + ')';
			}

			return cb(error);
		}

		var resolved = server.address();

		logger.notice('Server running at http://' + resolved.address + ':' + resolved.port);

		return cb();
	}

	// listen() can throw, despite the error listener
	// this happens in cluster mode if the stdio channels have been closed by the master

	server.on('error', callback);

	try {
		if (host) {
			server.listen(port, host, callback);
		} else {
			server.listen(port, callback);
		}
	} catch (error) {
		// listen() can throw, despite the error listener
		// this happens in cluster mode if the stdio channels have been closed by the master

		setImmediate(function () {
			callback(error);
		});
	}
}


/**
 * Starts listening on a given address. If the server is already listening on an address, it will
 * unbind from it first. Either a port (with optional host), or a file path must be provided.
 *
 * @param {Object} binding         The address to bind to.
 * @param {number} [binding.port]  TCP port.
 * @param {string} [binding.host]  TCP host (defaults to INADDR_ANY).
 * @param {string} [binding.file]  Path to a socket file to bind on.
 * @param {Function} cb
 */

exports.listen = function (binding, cb) {
	if (isListening) {
		// close, then listen again with the new arguments

		logger.debug('HTTP server already listening, closing and rebinding with new configuration.');

		return exports.close(function () {
			exports.listen(binding, cb);
		});
	}

	// listen in cluster mode will not throw catcheable errors (due to the asynchronous nature).
	// errors can only be intercepted when listening for the event.

	// deal with errors and success

	function callback(error) {
		if (error) {
			return cb(error);
		}

		return cb(null, server.address());
	}

	// listen

	if (binding.hasOwnProperty('port')) {
		bindToPort(binding.port, binding.host, callback);
	} else if (binding.hasOwnProperty('file')) {
		bindToFile(binding.file, callback);
	} else {
		var error = new Error('No valid binding provided (required: "port" or "file").');

		setImmediate(function () {
			callback(error);
		});
	}
};


exports.close = function (cb) {
	if (isListening) {
		isListening = false;

		server.close(cb);
	} else if (cb) {
		setImmediate(cb);
	}
};


server.once('listening', function () {
	// We need to also listen for process.exit in case that gets called.
	process.once('exit', function () {
		exports.close();
	});
});


exports.server = server;


exports.setCorsConfig = function (config) {
	if (!config) {
		cors = undefined;
		return;
	}

	// the wildcard origin ONLY works on requests without credentials

	var methods = Array.isArray(config.methods) ? config.methods.join(', ') : config.methods;

	cors = {
		methods: (methods || 'GET, POST, PUT, DELETE, HEAD, OPTIONS').toUpperCase(),
		origin: config.origin || '*',
		credentials: !!config.credentials
	};

	if (cors.origin === '*' && cors.credentials) {
		logger.alert
			.details('More info: https://developer.mozilla.org/en/docs/HTTP/Access_control_CORS#Requests_with_credentials')
			.log('CORS has been misconfigured to allow any origin and to allow credentials.');
	}
};


exports.getCorsConfig = function () {
	return cors;
};


var expose;

exports.expose = function (config) {
	if (config) {
		if (typeof config === 'object') {
			config = url.format({
				protocol: config.protocol || 'http',
				hostname: config.host || 'localhost',
				port: config.port || undefined,
				auth: (config.authUser && config.authPass) ? config.authUser + ':' + config.authPass : undefined,
				pathname: config.path || undefined
			});
		}

		if (typeof config !== 'string') {
			throw new TypeError('Expose URL is not a string: ' + config);
		}
	}

	expose = config;
};


exports.getClientHostBaseUrl = function (headers) {
	if (!expose && headers && headers.host) {
		// Use the host header to generate a string

		expose = url.format({
			protocol: 'http',
			host: headers.host
		});
	}

	// If nothing has been configured, and no headers were passed, the base URL will have to be
	// guessed. Alternatively, a relative path combined with a URL somewhere can be constructed.
	// We return empty string, because it's falsy and still can be safely concatenated with
	// paths.

	if (!expose) {
		return '';
	}

	// drop trailing slashes

	while (expose.slice(-1) === '/') {
		expose = expose.slice(0, -1);
	}

	return expose;
};


exports.getRouteUrl = function (route) {
	var baseUrl = exports.getClientHostBaseUrl();

	if (route[0] !== '/') {
		route = '/' + route;
	}

	return baseUrl + route;
};
