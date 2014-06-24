var http = require('http');
var url = require('url');
var zlib = require('zlib');
var WebSocketServer = require('ws').Server;
var mage = require('../../../mage');
var logger = mage.core.logger.context('http');

var server, wsServer;
var isListening = false;

/**
 * @type {Object} CORS configuration for the clientHost
 */

var cors = mage.core.config.get(['server', 'clientHost', 'cors']);

if (cors) {
	// allowed request methods

	if (Array.isArray(cors.methods)) {
		cors.methods = cors.methods.join(', ');
	}

	if (!cors.methods) {
		cors.methods = 'GET, POST, PUT, DELETE, HEAD, OPTIONS';
	}

	// allowed origin

	if (!cors.origin) {
		// the wildcard origin ONLY works on requests without credentials

		cors.origin = '*';
	}
}

function testCorsSanity() {
	if (cors && cors.origin === '*' && cors.credentials) {
		logger.alert
			.details('More info: https://developer.mozilla.org/en/docs/HTTP/Access_control_CORS#Requests_with_credentials')
			.log('CORS has been configured to allow any origin and to allow credentials.');
	}
}


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

var routes = {
	exact: {},		// string match
	re: []			// regexp
};


function getRoute(path) {
	if (path.substr(-1) === '/') {
		path = path.slice(0, -1);	// drop last slash
	}

	// find a handler that was registered to this exact route

	var route = routes.exact[path];
	if (route) {
		return route;
	}

	// if no exact route handler found, try the regexp registered routes

	for (var i = 0, len = routes.re.length; i < len; i++) {
		if (path.match(routes.re[i].matcher)) {
			return routes.re[i];
		}
	}

	return undefined;
}


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
	return function (connection, urlInfo) {
		fn(connection, urlInfo);
	};
}


/**
 * @param {string|RegExp} pathMatch
 * @param {Function}      fn
 * @param {string}        type
 */

exports.addRoute = function (pathMatch, fn, type) {
	// supported types: callback, simple, websocket
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
		break;
	case 'callback':
		handler = createCallbackHandler(fn);
		break;
	case 'websocket':
		handler = createWebSocketHandler(fn);
		break;
	default:
		throw new Error('Unknown route handler type: ' + type);
	}

	// pathMatch is a regexp or string to match on
	// register it as the route

	if (typeof pathMatch === 'string') {
		// add a starting slash

		if (pathMatch[0] !== '/') {
			pathMatch = '/' + pathMatch;
		}

		// strip the final slash

		if (pathMatch.substr(-1) === '/') {
			pathMatch = pathMatch.slice(0, -1);
		}

		routes.exact[pathMatch] = { matcher: pathMatch, handler: handler, type: type };
	} else {
		routes.re.push({ matcher: pathMatch, handler: handler, type: type });
	}

	logger.verbose('Added route:', pathMatch);
};


exports.delRoute = function (pathMatch) {
	if (typeof pathMatch === 'string') {
		// add a starting slash

		if (pathMatch[0] !== '/') {
			pathMatch = '/' + pathMatch;
		}

		// strip the final slash

		if (pathMatch.substr(-1) === '/') {
			pathMatch = pathMatch.slice(0, -1);
		}

		delete routes.exact[pathMatch];
	} else {
		for (var i = 0; i < routes.re.length; i++) {
			if (routes.re.matcher === pathMatch) {
				routes.re.splice(i, 1);
				break;
			}
		}
	}

	logger.verbose('Removed route:', pathMatch);
};


// set the default favicon to a mage logo

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


exports.setFavicon = function (buffer, mimetype) {
	var headers = {
		'content-type': mimetype || 'image/x-icon',
		'content-length': buffer.length
	};

	exports.addRoute('/favicon.ico', function (req, path, params, cb) {
		if (buffer === defaultFaviconBuff) {
			logger.debug('Serving default MAGE favicon.ico');
		} else {
			logger.debug('Serving custom favicon.ico');
		}

		cb(200, buffer, headers);
	});
};


exports.setFavicon(defaultFaviconBuff);


// HTTP request handling

function requestHandler(req, res) {
	logger.debug('Received HTTP', req.method, 'request:', req.url);

	var reqStart = Date.now();

	function complainAboutLongRequest() {
		var duration = Date.now() - reqStart;
		if (duration > 500) {
			logger.warning(req.url, 'completed in', Date.now() - reqStart, 'msec');
		}
	}

	res.once('finish', complainAboutLongRequest);

	var urlInfo = url.parse(req.url, true, true);

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

	// get the route handler

	var path = decodeURIComponent(urlInfo.pathname);
	var route = getRoute(path);

	// if no handler was found for this route, return: 404 Not found

	if (!route) {
		logger.warning.data(req).log('No route has been registered for this HTTP request (404)');
		res.writeHead(404);
		res.end();
		return;
	}

	// execute the handler

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
	var urlInfo = url.parse(req.url, true, true);

	var path = decodeURIComponent(urlInfo.pathname);
	var route = getRoute(path);

	if (!route) {
		logger.warning.data(req).log('No route has been registered for this WebSocket request (404)');

		return abortConnection(socket, 404, 'Not Found');
	}

	if (route.type !== 'websocket') {
		logger.warning.data(req).log('The handler registered on this route is not for websockets (404)');

		return abortConnection(socket, 400, 'Bad Request');
	}

	wsServer.handleUpgrade(req, socket, head, route.handler);
}


server = http.createServer();
wsServer = new WebSocketServer({ noServer: true });

server.on('request', requestHandler);
server.on('upgrade', upgradeHandler);

server.on('listening', function () {
	isListening = true;

	testCorsSanity();
});

server.on('close', function () {
	isListening = false;
	logger.notice('HTTP server closed');
});

server.on('error', function () {
	// on error, sockets are automatically closed
	isListening = false;
});


exports.listen = function () {
	// listen in cluster mode will not throw catcheable errors (due to the asynchronous nature).
	// errors can only be intercepted when listening for the event.

	// copy all arguments, but not the given callback
	// we want to inject our own

	var args = [];
	var len = arguments.length;

	for (var i = 0; i < len - 1; i++) {
		args.push(arguments[i]);
	}

	var cb = arguments[len - 1];

	// if no callback is given, we'll want listen() to be able to throw errors
	// in other words: our work here is done

	if (typeof cb !== 'function') {
		server.listen.apply(server, arguments);
		return;
	}

	// deal with errors and success

	function errorHandler(error) {
		cb(error);
	}

	function successHandler() {
		server.removeListener('error', errorHandler);
		cb(null, server.address());
	}

	args.push(successHandler);

	server.once('error', errorHandler);

	// try to listen

	try {
		server.listen.apply(server, args);
	} catch (error) {
		// listen() can throw, despite the error listener
		// this happens in cluster mode if the stdio channels have been closed by the master

		errorHandler(error);
	}
};

function cleanupServer() {
	if (isListening) {
		server.close();

		isListening = false;
	}
}

mage.once('shutdown', cleanupServer);

server.once('listening', function () {
	// We need to also listen for process.exit in case that gets called.
	process.once('exit', cleanupServer);
});


exports.server = server;


exports.getCorsConfig = function () {
	return cors;
};


exports.getClientHostBaseUrl = function (headers) {
	var expose = mage.core.config.get(['server', 'clientHost', 'expose']);

	if (!expose && headers && headers.host) {
		// Use the host header to generate a string

		expose = url.format({
			protocol: 'http',
			host: headers.host
		});
	}

	if (expose && typeof expose === 'object') {
		expose = url.format({
			protocol: 'http',
			hostname: expose.host || 'localhost',
			port: expose.port || undefined,
			auth: (expose.authUser && expose.authPass) ? expose.authUser + ':' + expose.authPass : undefined,
			pathname: expose.path || undefined
		});
	}

	// If nothing has been configured, and no headers were passed, the base URL will have to be
	// guessed. Alternatively, a relative path combined with a URL somewhere can be combined.
	// We return empty string, because it's falsy and still can be safely concatenated with
	// paths.

	if (!expose) {
		return '';
	}

	if (typeof expose !== 'string') {
		throw new TypeError('Expose URL is not a string: ' + expose);
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
