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


function Address(name, storeRelay) {
	this.name = name;
	this.storeRelay = storeRelay;
}


Address.prototype.setConnection = function (res, transport) {
	this.res = res;
	this.transport = transport;
};


Address.prototype.close = function () {
	delete this.res;
};


var addressMap = {};


function registerOrGetAddress(name, storeRelay) {
	var address = addressMap[name];
	if (address) {
		address.storeRelay = storeRelay;
	} else {
		address = addressMap[name] = new Address(name, storeRelay);
	}

	return address;
}


function findAddress(name) {
	return addressMap[name] || null;
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

		address.setConnection(res, transport);

		// confirm previous messages

		if ('confirmIds' in info.query) {
			console.log('Confirming', info.query.confirmIds);

			msgServer.comm.confirm(addrName, session.host, info.query.confirmIds.split(','));
		}

		// pull in events

		switch (transport) {
		case 'longpolling':
			console.log('>>>>> connecting for longpolling');

			msgServer.comm.connect(addrName, address.storeRelay);
			break;

		case 'shortpolling':
			console.log('>>>>> forwarding for shortpolling');

			msgServer.comm.forward(addrName, address.storeRelay);
			break;

		default:
			res.writeHead(400, { 'Content-Type': 'text/plain' });
			res.end('Invalid transport');
			break;
		}
	});
}


// HTTP route handling

var routes = {
	exact: {},		// string match
	re: []			// regexp
};


exports.addRoute = function (pathMatch, fn) {
	// pathMatch is a regexp or string to match on

	// registered functions NEED to call response.end!

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


function handleRoute(urlInfo, request, response) {
	// parse URL

	var path = urlInfo.pathname;

	if (path.substr(-1) === '/') {
		path = path.slice(0, -1);	// drop last slash
	}


	// if no route found for this path, return: 404 Not found

	var handler = routes.exact[path];

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

	if (!handler) {
		return false;
	}


	handler(request, path, urlInfo.query, function (httpCode, out, headers) {
		if (httpCode === false) {
			httpCode = 404;

			if (!out) {
				out = '404 Not found';
			}
		}

		response.writeHead(httpCode, headers);
		response.end(out);
	});

	return true;
}


// HTTP request handling

function handleCommand(req, res, addrName, urlInfo, data) {
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

	msgServer.processCommandRequest(transportInfo, urlInfo.pathname, queryId, header, message, function (content, options) {
		options = options || {};
		var headers = options.httpHeaders || {};

		// send the command response back to the client

		if (typeof content === 'object') {
			content = JSON.stringify(content);
			options.mimetype = 'application/json';
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


function handleHttpRequest(req, res, urlInfo, data) {
	// if no registered route matches, call handleCommand()

	var handled = handleRoute(urlInfo, req, res);

	if (!handled) {
		var addrName = generateSessionAddress(urlInfo.query.sessionKey);

		handleCommand(req, res, addrName, urlInfo, data);
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
	var query = urlInfo.query;
	var data = '';

	// pull the session core info out of membase, so that we know we can trust it, and we know where the relay is

	req.on('data', function (chunk) {
		data += chunk;
	});

	req.on('end', function () {
		if (urlInfo.pathname === '/msgstream') {
			// message stream request

			handleMsgStream(req, res, urlInfo, query.transport);
		} else {
			// other request, probably command execution

			handleHttpRequest(req, res, urlInfo, data);
		}
	});
}


exports.server = http.createServer(httpHandler);


exports.deliverMessages = function (addrName, msgs) {
	addrName = addrName.toString('utf8');

	var address = addressMap[addrName];

	console.log('deliverMessages called for address', addrName);
	console.log('Current address map:', Object.keys(addressMap));

	if (address && address.res) {
		switch (address.transport) {
		case 'longpolling':
			// if there are no messages, we wait

			if (msgs) {
				console.log('Sending messages...', msgs);

				address.res.writeHead(200, { 'Content-Type': 'application/json' });
				address.res.end(JSON.stringify(msgs));

				msgServer.comm.disconnect(addrName, address.storeRelay);

				address.close();
				delete addressMap[addrName];
			} else {
				console.log('Nothing to send yet, pending...');
			}
			break;

		case 'shortpolling':
			// if there are no messages, we drop the connection anyway

			var response = msgs ? JSON.stringify(msgs) : '';

			address.res.writeHead(200, { 'Content-Type': 'application/json' });
			address.res.end(response);

			address.close();
			delete addressMap[addrName];
			break;

		default:
			address.res.writeHead(200, { 'Content-Type': 'text/plain' });
			address.res.end('Unknown transport.');

			address.close();
			delete addressMap[addrName];
			break;
		}
	}
};

