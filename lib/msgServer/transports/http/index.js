var http = require('http'),
    url = require('url'),
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

Address.prototype.setupConnectionTimeout = function (cb) {
	var that = this;

	if (!longpollingDuration) {
		longpollingDuration = mithril.core.config.get('server.clientHost.transports.longpolling.heartbeat', 60) * 1000;
	}

	this.timeoutTimer = setTimeout(function () {
		that.timeoutTimer = null;
		cb();
		that.res = undefined;
	}, longpollingDuration);

	// the following would also work, but yield http return code 0 in the XMLHttpRequest:
	// res.connection.setTimeout(5000, function () {});
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

		this.setupConnectionTimeout(function () {
			// TODO: check that this works when the browser is gone

			sendHttpResponse(res, 200, { 'Content-Type': 'text/plain; charset=utf8' }, 'HB');
		});

		// pull in events

		msgServer.comm.connect(this.name, this.storeRelay);
		break;

	case 'shortpolling':
		// pull in events

		msgServer.comm.forward(this.name, this.storeRelay);
		break;

	default:
		sendHttpResponse(res, 400, { 'Content-Type': 'text/plain; charset=utf8' }, 'Invalid transport');
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
	var sessionKey = info.query.sessionKey;

	var address;

	req.on('close', function () {
		if (address) {
			address.close();
		}
	});

	// resolve the session

	mithril.session.resolve(sessionKey, function (error, session) {
		if (error || !session) {
			sendHttpResponse(res, 401, { 'Content-Type': 'text/plain' }, 'Unknown session');
			return;
		}

		// address resolution

		var addrName = generateSessionAddress(sessionKey);

		address = registerOrGetAddress(addrName, session.host);

		// confirm previous messages

		if ('confirmIds' in info.query) {
			msgServer.comm.confirm(addrName, session.host, info.query.confirmIds.split(','));
		}

		// set the connection on the address (triggering a pull on events)

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
		return false;
	}

	// execute the handler

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

function handleCommand(req, res, urlInfo, data) {
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
	var cmdNames = path.join('/').split(',');

	var app = mithril.core.app.get(appName);

	if (!app || cmdNames.length === 0 || typeof data !== 'string') {
		return sendHttpResponse(res, 400);	// 400: Bad request
	}

	// parse the data into a header part, and a params part

	data = data.split('\n');

	var headerData = data.shift();
	var paramsData = data.join('\n');

	// set a transport type, and pull the optional queryId from the URL querystring

	var transportInfo = { type: 'http' };

	var queryId = urlInfo.query.queryId || null;


	// execute the command list

	var startTime = logger.has('time') ? Date.now() : null;

	app.commandCenter.executeCommands(cmdNames, headerData, paramsData, queryId, transportInfo, function (content, options) {
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

		if (startTime) {
			logger.time('User command', urlInfo.pathname, 'execution took', (Date.now() - startTime), 'msec.');
		}

		sendHttpResponse(res, statusCode, headers, content);
	});
}


function handleHttpRequest(req, res, urlInfo) {
	// if no registered route matches, call handleCommand()

	var handled = handleRoute(req, res, urlInfo);

	if (!handled) {
		var data = '';

		req.on('data', function (chunk) {
			data += chunk;
		});

		req.on('end', function () {
			handleCommand(req, res, urlInfo, data);
		});
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

	logger.debug('Received HTTP request: ' + req.url);

	var urlInfo = url.parse(req.url, true, true);

	if (urlInfo.pathname === '/msgstream') {
		// message stream request

		handleMsgStream(req, res, urlInfo, urlInfo.query.transport);
	} else {
		// other request, probably command execution

		handleHttpRequest(req, res, urlInfo);
	}
}


exports.server = http.createServer(httpHandler);


exports.deliverMessages = function (addrName, msgs) {
	// msgs is

	addrName = addrName.toString('utf8');

	var address = addressMap[addrName];

	if (address) {
		address.deliver(msgs);
	}
};

