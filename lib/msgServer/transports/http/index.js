var http = require('http'),
    url = require('url'),
    mithril = require('../../../mithril'),
    msgServer = mithril.core.msgServer;


// Note: each entry in the msgServerMap should look like the following
// msgServerKey : {req:req, :res:res}
//
// However, we will have to support
// msgServerKey : [ msgServerEntryRef1, msgServerEntryRef2, ...];
// This way we will be able to do nicely distributed server level user broadcast, instead of relying on the store to do so.
// However, this wil also mean that once this key to array is implemented, we will have to find a way to do so on the store
// end as well... so for now, we will only do one-to-one-to-one until we implement one-to-many distributed references

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

			res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf8' });
			res.end('HB');
		});

		// pull in events

		msgServer.comm.connect(this.name, this.storeRelay);
		break;

	case 'shortpolling':
		// pull in events

		msgServer.comm.forward(this.name, this.storeRelay);
		break;

	default:
		res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf8' });
		res.end('Invalid transport');
		break;
	}
};


Address.prototype.deliver = function (msgs) {
	var header, response;

	// TODO: msgs should already be serialized, JSON.stringify does NOT make sense!

	// if there is still a connection, respond

	if (!this.res) {
		return;
	}

	switch (this.transport) {
	case 'longpolling':
		// if there are no messages, we wait

		if (!msgs) {
			return;
		}

		response = JSON.stringify(msgs);

		this.res.writeHead(200, { 'Content-Type': 'application/json; charset=utf8' });
		this.res.end(response);

		msgServer.comm.disconnect(this.name, this.storeRelay);
		break;

	case 'shortpolling':
		// if there are no messages, we drop the connection anyway

		if (msgs) {
			header = { 'Content-Type': 'application/json; charset=utf8' };
			response = JSON.stringify(msgs);
		} else {
			header = { 'Content-Type': 'text/plain; charset=utf8' };
			response = '';
		}

		this.res.writeHead(200, header);
		this.res.end(response);
		break;

	default:
		this.res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf8' });
		this.res.end('Invalid transport.');
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
			res.writeHead(401, { 'Content-Type': 'text/plain' });
			res.end('Unknown session');
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
	// after parsing, we send the parsed message to the msgServer so it can route it into the command center
	// the callback we pass into it will receive a response that we'll send back to the client

	var header = [], message;
	var headerDelimiterCharacter = '\t';

	try {
		var headerDelim = data.indexOf(headerDelimiterCharacter);
		if (headerDelim === -1) {
			message = data;
		} else {
			header = JSON.parse(data.substring(0, headerDelim));
			message = data.substring(headerDelim + 1);
		}
	} catch (e) {
		res.writeHead(400, { 'Content-Type': 'text/plain' });
		res.end('Parse error');
		return;
	}

	var transportInfo = { type: 'http' };

	var queryId = urlInfo.query.queryId || null;

	// TODO: if commandCenter would register all the exact routes, the following would not be required

	msgServer.processCommandRequest(transportInfo, urlInfo.pathname, queryId, header, message, function (content, options) {
		options = options || {};
		var headers = options.httpHeaders || {};

		// send the command response back to the client

		if (typeof content === 'object') {
			content = JSON.stringify(content);
			options.mimetype = 'application/json; charset=utf8';
		}

		if (options.mimetype) {
			headers['Content-Type'] = options.mimetype;
		}

		if (options.encoding) {
			headers['Content-Encoding'] = options.encoding;
		} else {
			// TODO: if it's not already compressed, and content length is sufficiently big, compress it now.
		}

		var statusCode = options.httpStatusCode || 200;	// 200: OK

		res.writeHead(statusCode, headers);
		res.end(content);
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
		res.writeHead(503);	// 503: Service Unavailable
		res.end('Server going down for maintenance.');
		return;
	}
*/

	mithril.core.logger.debug('Received HTTP request: ' + req.url);

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

