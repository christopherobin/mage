var http = require('http'),
    url = require('url'),
    MultipartParser = require('multipart-parser'),
    mithril = require('../../../mithril'),
    logger = mithril.core.logger,
    msgServer = mithril.core.msgServer;


// Note: each entry in the msgServerMap should look like the following
// msgServerKey : {req:req, :res:res}
//
// However, we will have to support
// msgServerKey : [ msgServerEntryRef1, msgServerEntryRef2, ...];
// This way we will be able to do nicely distributed server level user broadcast, instead of relying on the store to do so.
// However, this wil also mean that once this key to array is implemented, we will have to find a way to do so on the store
// end as well... so for now, we will only do one-to-one-to-one until we implement one-to-many distributed references

function sendHttpResponse(res, statusCode, headers, body) {
	// TODO: if the response is not yet compressed, auto-gzip on big response bodies

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

Address.prototype.setupConnectionTimeout = function (res) {
	var that = this;

	if (!longpollingDuration) {
		longpollingDuration = mithril.core.config.get('server.clientHost.transports.longpolling.heartbeat', 60) * 1000;
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
		this.timeroutTimer = null;
	}
};


Address.prototype.setConnection = function (res, transport) {
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
	var header, response;

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

			logger.debug('Relaying messages', response);
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
		logger.debug('Responding 200 to HEAD request');

		sendHttpResponse(res, 200);
		return;
	}

	var sessionKey = info.query.sessionKey;

	// resolve the session

	mithril.session.resolve(sessionKey, function (error, session, msg) {
		if (error) {
			sendHttpResponse(res, 500);  // 500: Internal service error
			return;
		}

		if (!session) {
			logger.debug('Responding 401: Unknown session');

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

		logger.debug('Connecting the message stream to this HTTP request');

		address.setConnection(res, transport);
	});
}


// HTTP route handling

var routes = {
	exact: {},		// string match
	re: []			// regexp
};


exports.addRoute = function (pathMatch, fn) {
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

		routes.exact[pathMatch] = fn;
	} else {
		routes.re.push({ matcher: pathMatch, handler: fn });
	}
};


function handleRoute(request, response, urlInfo) {
	// parse URL

	var path = urlInfo.pathname;

	if (path.substr(-1) === '/') {
		path = path.slice(0, -1);	// drop last slash
	}


	// find a handler that was registered to this exact route

	var handler = routes.exact[path];

	// if no exact route handler found, try the regexp registered routes

	if (!handler) {
		var i, len;

		for (i = 0, len = routes.re.length; i < len; i++) {
			var route = routes.re[i];

			if (path.match(route.matcher)) {
				handler = route.handler;
				break;
			}
		}
	}

	// if still no handler found for this route, return: 404 Not found

	if (!handler) {
		logger.debug('No registered route exists for this HTTP request');
		return false;
	}

	// execute the handler

	logger.debug('Following HTTP route');

	handler(request, path, urlInfo.query, function (httpCode, out, headers) {
		if (httpCode === false) {
			httpCode = 500;	// internal server error
		}

		response.writeHead(httpCode, headers);
		response.end(out);
	});

	return true;
}


// HTTP request handling

function executeCommands(res, app, cmdNames, data, files, queryId, transportInfo) {
	if (typeof data !== 'string') {
		logger.error('HTTP response 400: bad request (data was not a string)');

		return sendHttpResponse(res, 400);  // 400: Bad request
	}

	// parse the data into a header part, and a params part

	data = data.split('\n');

	var headerData = data.shift();
	var paramsData = data.join('\n');


	// execute the command list

	app.commandCenter.executeCommands(cmdNames, headerData, paramsData, files, queryId, transportInfo, function onCommandResponse(content, options) {
		// only strings and buffers allowed

		if (content && typeof content !== 'string' && !Buffer.isBuffer(content)) {
			logger.error('Non-string/buffer value responded by executeCommands:', content);

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
		logger.debug('Responding 200 to HEAD request');

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

	var app = mithril.core.app.get(appName);

	if (!app) {
		logger.error('File not found:', urlInfo.pathname);

		return sendHttpResponse(res, 404);  // 400: Bad request
	}

	var cmdNames = path.join('/').split(',');

	if (cmdNames.length === 0) {
		logger.error('No commands given');

		return sendHttpResponse(res, 400);  // 400: Bad request
	}

	// check if this client is allowed to do this request

	if (app.firewall && !app.firewall(req.connection, req)) {
		logger.error('Firewall bounced the HTTP request');

		return sendHttpResponse(res, 401);  // 401, unauthorized
	}

	// set a transport type, and pull the optional queryId from the URL querystring

	var transportInfo = { type: 'http' };

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
				// unidentifyable parts cannot be used

				logger.debug('Received an unidentifyable part, skipping.');
				return;
			}

			m = disp.match(/name="(.+?)"/);
			if (!m) {
				// unnamed parts cannot be used

				logger.debug('Received an unnamed part, skipping.');
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
			logger.debug('Finished reading multipart POST data.');

			executeCommands(res, app, cmdNames, cmdData, files, queryId, transportInfo);
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
			logger.debug('Finished reading singlepart POST data.');

			executeCommands(res, app, cmdNames, data, null, queryId, transportInfo);
		});
	}
}


function handleHttpRequest(req, res, urlInfo) {
	// if no registered route matches, call handleCommand()

	var handled = handleRoute(req, res, urlInfo);

	if (!handled) {
		logger.debug('No matching route found, assuming HTTP request was for a user command');

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

	logger.info('Received HTTP', req.method, 'request:', req.url);

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

server.once('listening', function () {
	isListening = true;

	server.on('close', function () {
		logger.info('HTTP server closed');
	});
});


mithril.once('shutdown', function () {
	if (!isListening) {
		return;
	}

	logger.info('Closing HTTP server (sending heartbeats)');

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
		address.deliver(msgs);
	}
};

