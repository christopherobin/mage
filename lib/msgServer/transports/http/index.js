var http = require('http');
var url = require('url');
var MultipartParser = require('multipart-parser');
var mage = require('../../../mage');
var logger = mage.core.logger.context('http');
var State = mage.core.State;
var msgServer = mage.core.msgServer;


// Note: each entry in the msgServerMap should look like the following
// msgServerKey : {req:req, :res:res}
//
// However, we will have to support
// msgServerKey : [ msgServerEntryRef1, msgServerEntryRef2, ...];
// This way we will be able to do nicely distributed server level user broadcast, instead of relying on the store to do so.
// However, this wil also mean that once this key to array is implemented, we will have to find a way to do so on the store
// end as well... so for now, we will only do one-to-one-to-one until we implement one-to-many distributed references

function sendHttpResponse(res, statusCode, headers, body) {
	if (!headers) {
		headers = {};
	}

	// some clients (iOS6) cache even post responses
	// aggressively disable all caching

	headers.Pragma = 'no-cache';

	res.writeHead(statusCode, headers);

	if (body) {
		res.end(body);
	} else {
		res.end();
	}
}


function generateSessionAddress(sessionKey) {
	return 'sess/' + sessionKey;
}


var addressMap = {};


function Address(name, storeRelay) {
	this.name = name;
	this.storeRelay = storeRelay;
}


var longpollingDuration;

Address.prototype.setupConnectionTimeout = function () {
	var that = this;

	if (!longpollingDuration) {
		longpollingDuration = mage.core.config.get(['server', 'clientHost', 'transports', 'longpolling', 'heartbeat'], 60) * 1000;
	}

	this.timeoutTimer = setTimeout(function () {
		that.timeoutTimer = null;

		that.sendHeartbeat();
	}, longpollingDuration);

	// the following would also work, but yield http return code 0 in the XMLHttpRequest:
	// res.connection.setTimeout(5000, function () {});
};


Address.prototype.sendHeartbeat = function () {
	// TODO: check that this works when the browser is gone

	if (this.res) {
		sendHttpResponse(this.res, 200, { 'Content-Type': 'text/plain; charset=utf8' }, 'HB');
		this.removeConnectionTimeout();
		this.res = undefined;
	}
};


Address.prototype.removeConnectionTimeout = function () {
	// if a timer existed, remove it

	if (this.timeoutTimer) {
		clearTimeout(this.timeoutTimer);
		this.timeoutTimer = null;
	}
};


Address.prototype.setConnection = function (res, transport) {
	if (this.res) {
		this.res.end();
	}

	this.res = res;
	this.transport = transport;
	this.timeoutTimer = null;

	switch (transport) {
	case 'longpolling':
		// set up a heartbeat response for longpolling

		this.setupConnectionTimeout();

		// pull in events

		msgServer.comm.connect(this.name, this.storeRelay);
		break;

	case 'shortpolling':
		// pull in events

		msgServer.comm.forward(this.name, this.storeRelay);
		break;

	default:
		sendHttpResponse(res, 400, { 'Content-Type': 'text/plain; charset=utf8' }, 'Invalid transport');
		this.res = undefined;
		break;
	}
};


Address.prototype.deliver = function (msgs) {
	var response;

	// if there is still a connection, respond

	if (!this.res) {
		return;
	}

	if (msgs) {
		// build a response JSON string
		// msgs: { msgId: jsonstring, msgId: jsonstring, msgId: jsonstring }

		var props = [];

		for (var msgId in msgs) {
			props.push('"' + msgId + '":' + msgs[msgId]);
		}

		if (props.length > 0) {
			response = '{' + props.join(',') + '}';

			logger.verbose('Relaying messages', response);
		}
	}

	switch (this.transport) {
	case 'longpolling':
		// if there are no messages, we wait

		if (!response) {
			return;
		}

		sendHttpResponse(this.res, 200, { 'Content-Type': 'application/json; charset=utf8' }, response);

		msgServer.comm.disconnect(this.name, this.storeRelay);
		break;

	case 'shortpolling':
		// if there are no messages, we drop the connection anyway

		if (response) {
			sendHttpResponse(this.res, 200, { 'Content-Type': 'application/json; charset=utf8' }, response);
		} else {
			sendHttpResponse(this.res, 200, { 'Content-Type': 'text/plain; charset=utf8' }, '');
		}
		break;

	default:
		sendHttpResponse(this.res, 400, { 'Content-Type': 'text/plain; charset=utf8' }, 'Invalid transport.');
		break;
	}

	// cleanup

	this.res = undefined;
	delete addressMap[this.name];

	this.removeConnectionTimeout();
};


Address.prototype.close = function () {
	this.removeConnectionTimeout();
	this.res = undefined;
};


function registerOrGetAddress(name, storeRelay) {
	var address = addressMap[name];
	if (address) {
		address.storeRelay = storeRelay;
	} else {
		address = addressMap[name] = new Address(name, storeRelay);
	}

	return address;
}


function handleMsgStream(req, res, info, transport) {
	// deal with HEAD requests

	if (req.method === 'HEAD') {
		logger.verbose.data(req).log('Responding 200 to HEAD request');

		sendHttpResponse(res, 200);
		return;
	}

	var sessionKey = info.query.sessionKey;

	// resolve the session

	var state = new State();

	mage.session.resolve(state, sessionKey, function (error, session, msg) {
		state.close();

		if (error) {
			sendHttpResponse(res, 500);  // 500: Internal service error
			return;
		}

		if (!session) {
			logger.warning.data(req).log('Responding 401: Unknown session');

			sendHttpResponse(res, 401, { 'Content-Type': 'text/plain; charset=utf8' }, msg || '');
			return;
		}

		// address resolution

		var addrName = generateSessionAddress(sessionKey);

		var address = registerOrGetAddress(addrName, session.host);

		req.on('close', function () {
			if (address) {
				address.close();
			}
		});

		// confirm previous messages

		if ('confirmIds' in info.query) {
			msgServer.comm.confirm(addrName, session.host, info.query.confirmIds.split(','));
		}

		// set the connection on the address (triggering a pull on events)

		logger.verbose('Connecting the message stream to this HTTP request');

		address.setConnection(res, transport);
	});
}


// HTTP route handling

var routes = {
	exact: {},		// string match
	re: []			// regexp
};


exports.addRoute = function (pathMatch, fn, streaming) {
	// pathMatch is a regexp or string to match on

	// fn will be called as: fn(http request, path, parsed query string, cb)
	// where cb is: function (httpCode, [out buffer or string, headers])

	if (typeof pathMatch === 'string') {
		// add a starting slash

		if (pathMatch[0] !== '/') {
			pathMatch = '/' + pathMatch;
		}

		// strip the final slash

		if (pathMatch.substr(-1) === '/') {
			pathMatch = pathMatch.slice(0, -1);
		}

		routes.exact[pathMatch] = { matcher: pathMatch, handler: fn, streaming: streaming };
	} else {
		routes.re.push({ matcher: pathMatch, handler: fn, streaming: streaming });
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


function handleRoute(req, res, urlInfo) {
	// parse URL

	var path = urlInfo.pathname;

	if (path.substr(-1) === '/') {
		path = path.slice(0, -1);	// drop last slash
	}


	// find a handler that was registered to this exact route

	var route = routes.exact[path];

	// if no exact route handler found, try the regexp registered routes

	if (!route) {
		var i, len;

		for (i = 0, len = routes.re.length; i < len; i++) {
			if (path.match(routes.re[i].matcher)) {
				route = routes.re[i];
				break;
			}
		}
	}

	// if still no handler found for this route, return: 404 Not found

	if (!route || !route.handler) {
		logger.verbose.data('header', req.header).log('No registered route exists for this HTTP request');
		return false;
	}

	// execute the handler

	logger.verbose('Following HTTP route', route.matcher);


	function withStream() {
		route.handler(req, res, path, urlInfo.query);
	}


	function withCallback() {
		route.handler(req, path, urlInfo.query, function (httpCode, out, headers) {
			if (httpCode === false) {
				// internal server error

				httpCode = 500;

				logger.critical.data(req).log('Internal server error during HTTP request:', path);
			} else {
				logger.info
					.data('url', req.url)
					.log('Completed HTTP request:', path);
			}

			res.writeHead(httpCode, headers);
			res.end(out);
		});
	}


	if (route.streaming) {
		withStream();
	} else {
		withCallback();
	}

	return true;
}


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

function executeCommands(res, app, cmdNames, data, files, queryId) {
	if (typeof data !== 'string') {
		logger.error('HTTP response 400: bad request (data was not a string)');

		return sendHttpResponse(res, 400);  // 400: Bad request
	}

	// parse the data into a header part, and a params part

	data = data.split('\n');

	var headerData = data.shift();
	var paramsData = data.join('\n');


	// execute the command list

	app.commandCenter.executeCommands(cmdNames, headerData, paramsData, files, queryId, function onCommandResponse(content, options) {
		// only strings and buffers allowed

		if (content && typeof content !== 'string' && !Buffer.isBuffer(content)) {
			logger.alert('Non-string/buffer value responded by executeCommands:', content);

			return sendHttpResponse(res, 500);	// internal server error
		}

		options = options || {};
		var headers = options.httpHeaders || {};

		// send the command response back to the client

		if (options.mimetype) {
			headers['Content-Type'] = options.mimetype;
		}

		if (options.encoding) {
			headers['Content-Encoding'] = options.encoding;
		}

		var statusCode = options.httpStatusCode || 200;	// 200: OK

		sendHttpResponse(res, statusCode, headers, content);
	});
}


function handleCommand(req, res, urlInfo) {
	// deal with HEAD requests

	if (req.method === 'HEAD') {
		logger.verbose.data(req).log('Responding 200 to HEAD request');

		return sendHttpResponse(res, 200);
	}

	// parsing really happens here:
	// - headers (message hooks)
	// - contents (deserialization)
	// - route
	// after parsing, we send all information to the relevant command center
	// the callback we pass into it will receive a response that we'll send back to the client

	// parse the path into appName and cmdNames

	var path = urlInfo.pathname;

	if (path[0] === '/') {
		path = path.substring(1);
	}

	path = path.split('/');

	var appName = path.shift();

	var app = mage.core.app.get(appName);

	if (!app) {
		logger.error.data(req).log('File not found:', req.url);

		return sendHttpResponse(res, 404);  // 404: File not found
	}

	var cmdNames = path.join('/').split(',');

	if (cmdNames.length === 0) {
		logger.error.data(req).log('No commands given');

		return sendHttpResponse(res, 400);  // 400: Bad request
	}

	// check if this client is allowed to do this request

	if (app.firewall && !app.firewall(req.connection, req)) {
		logger.error.data(req).log('Firewall bounced the HTTP request');

		return sendHttpResponse(res, 401);  // 401, unauthorized
	}

	// set a transport type, and pull the optional queryId from the URL querystring

	var queryId = urlInfo.query.queryId || null;


	// grab the posted data

	// check for multipart streams that can contain file uploads

	var contentType = req.headers['content-type'] || '';
	var m = contentType.match(/^multipart\/form-data; boundary=(.+)$/);

	if (m && m[1]) {
		// multipart, the first part has to be the same format as single part post data

		var parser = MultipartParser.create(m[1]);
		var files = {};
		var cmdData = '';

		parser.on('part', function (part) {
			var m, disp, partName, fileName, isCmdData;

			disp = part.headers['content-disposition'];
			if (!disp) {
				// unidentifiable parts cannot be used

				logger.warning.data('partHeaders', part.headers).log('Received an unidentifyable part, skipping.');
				return;
			}

			m = disp.match(/name="(.+?)"/);
			if (!m) {
				// unnamed parts cannot be used

				logger.warning.data('partHeaders', part.headers).log('Received an unnamed part, skipping.');
				return;
			}

			partName = m[1];

			isCmdData = (partName === 'cmddata');

			m = disp.match(/filename="(.+?)"/);
			if (m) {
				// a filename is optional

				fileName = m[1];
			}

			// the first part is ready and is expected to be the same format as single part post data

			var data = [];

			part.on('data', function (chunk) {
				if (isCmdData) {
					// treat as utf8

					cmdData += chunk.toString('utf8');
				} else {
					data.push(chunk);
				}
			});

			if (!isCmdData) {
				part.on('end', function () {
					// create the files object for the following files, the command center can take care of the rest

					files[partName] = {
						data: data,
						partName: partName,
						fileName: fileName,
						type: part.headers['content-type']
					};
				});
			}
		});

		parser.on('end', function () {
			logger.verbose('Finished reading multipart', req.method, 'request.');

			executeCommands(res, app, cmdNames, cmdData, files, queryId);
		});

		// pipe all incoming data straight into the multipart parser

		req.pipe(parser);
	} else {
		// single part

		req.setEncoding('utf8');

		var data = '';

		req.on('data', function (chunk) {
			data += chunk;
		});

		req.on('end', function () {
			logger.verbose('Finished reading', req.method, 'request.');

			executeCommands(res, app, cmdNames, data, null, queryId);
		});
	}
}


function handleHttpRequest(req, res, urlInfo) {
	// if no registered route matches, call handleCommand()

	var handled = handleRoute(req, res, urlInfo);

	if (!handled) {
		logger.verbose('No matching route found, assuming HTTP request was for a user command');

		handleCommand(req, res, urlInfo);
	}
}


function httpHandler(req, res) {
	// Register session, and keep somewhere in memory space req and res association to the session id;
	// This method should normally do the following:
	// 1) Get session info from membase (from the memcached bucket)
	// 2) attach locally the req and res object to that session. in the case of
	//    multinode async call, we will close the connection on our own at a later time

/*
	// if we're shutting down, don't accept the request

	if (shutdown) {
		// 503: Service Unavailable
		sendHttpResponse(res, 503, {}, 'Server going down for maintenance.');
		return;
	}
*/

	logger.verbose('Received HTTP', req.method, 'request:', req.url);

	var urlInfo = url.parse(req.url, true, true);

	if (urlInfo.pathname === '/msgstream') {
		// message stream request

		handleMsgStream(req, res, urlInfo, urlInfo.query.transport);
	} else {
		// other request, probably command execution

		handleHttpRequest(req, res, urlInfo);
	}
}


var server = http.createServer(httpHandler);
var isListening = false;

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


mage.once('shutdown', function () {
	if (!isListening) {
		return;
	}

	logger.verbose('Closing HTTP server (sending heartbeats)');

	for (var addrName in addressMap) {
		var address = addressMap[addrName];

		if (address) {
			address.sendHeartbeat();
		}
	}

	server.close();
});


exports.server = server;


exports.deliverMessages = function (addrName, msgs) {
	addrName = addrName.toString('utf8');

	var address = addressMap[addrName];

	if (address) {
		logger.verbose.data('messages', msgs).log('Delivering messages');

		address.deliver(msgs);
	} else {
		logger.warning.data('messages', msgs).log('Could not deliver messages, address gone');
	}
};


exports.getClientHostBaseUrl = function () {
	var expose = mage.core.config.get(['server', 'clientHost', 'expose'], {});

	if (typeof expose !== 'string') {
		expose = url.format({
			protocol: 'http',
			hostname: expose.host || 'localhost',
			port: expose.port || undefined,
			auth: (expose.authUser && expose.authPass) ? expose.authUser + ':' + expose.authPass : undefined,
			pathname: expose.path || undefined
		});
	}

	// drop trailing slashes

	if (expose[expose.length - 1] === '/') {
		expose = expose.substr(0, expose.length - 1);
	}

	return expose;
};


exports.getRouteUrl = function (route) {
	var baseUrl = exports.getClientHostBaseUrl();

	if (route[0] !== '/') {
		route = '/' + route;
	}

	if (baseUrl[baseUrl.length - 1] === '/') {
		baseUrl = baseUrl.substring(0, baseUrl.length - 1);
	}

	return baseUrl + route;
};
