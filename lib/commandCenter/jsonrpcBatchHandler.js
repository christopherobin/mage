var mage;
var logger;

var jayson = require('jayson');
var utils = jayson.utils;

var MAGE_HEADER_FIELD = 'x-mage';

/**
 * Returns a router to provide to jayson
 *
 * @param   {object}    commandCenter   The command center containing the commands to call.
 * @returns {Function}  The router function
 */
function createJsonrpcRouter(commandCenter) {
	/**
	 * The router function
	 *
	 * @param   {string}    method  The name of the method to call
	 * @param   {Object}    params  The request parameters
	 * @returns {Function}  The method called by jayson.
	 */
	return function (method, params) {
		// Extract the session from the params, then remove it
		var session = params.mageSession;
		delete params.mageSession;

		var cmd = {
			name: method,
			params: params
		};

		/**
		 * Method called by jayson to run the command
		 *
		 * The last argument is the callback to call when the command has been executed.
		 * The previous arguments are not used by MAGE for now.
		 */
		return function () {
			var callback = arguments[arguments.length - 1];

			var cmdInfo = commandCenter.getCommandInfo(cmd.name);
			if (!cmdInfo) {
				return callback(this.error(jayson.Server.errors.METHOD_NOT_FOUND));
			}

			try {
				cmd.params = commandCenter.buildParamList(cmdInfo.mod.params, cmd.params);
			} catch (err) {
				return callback(this.error(jayson.Server.errors.INVALID_PARAMS, err.message));
			}

			commandCenter.executeCommand(cmd, session, callback);
		};
	};
}

/**
 * Extract the MAGE custom header fields from the request headers.
 *
 * @param   {Object}    requestHeaders  Headers from the HTTP request
 * @returns {Object[]}  MAGE headers
 */
function extractMageHeaders(requestHeaders) {
	var headers = Object.keys(requestHeaders)
		// Ignore the headers where the name is not prefixed with the MAGE header field name
		.filter(function (name) {
			return name.indexOf(MAGE_HEADER_FIELD) === 0;
		})
		// Create a new object with the filtered header fields
		// Remove the unused part from the header field names
		.map(function (idx) {
			var name = idx.replace(new RegExp('^' +  MAGE_HEADER_FIELD + '-(.*)$', 'i'), 'mage.$1');
			return {
				name: name,
				key: requestHeaders[idx]
			};
		});

	return headers;
}

/**
 * Build a valid JSON-RPC error response
 *
 * @param {Object}      jsonrpcServer   The jayson instance
 * @param {Object}      request         The JSON-RPC request
 * @param {number}      code            The JSON-RPC error code
 * @param {string}      err             The error message
 * @returns {Object}    Formatted JSON-RPC error response
 */
function buildErrorResponse(jsonrpcServer, request, code, err) {
	return jayson.utils.response(jsonrpcServer.error(
		code,
		err
	), null, request.id);
}

/**
 * Stick a session to the request params
 *
 * @param {Object}  request   The JSON-RPC request
 * @param {Session} session         The session
 */
function addSessionToRequest(request, session) {
	function addSessionToParams(requestObject) {
		if (!requestObject.params) {
			requestObject.params = {};
		}
		requestObject.params.mageSession = session;
	}

	if (Array.isArray(request)) {
		request.forEach(function (requestObject) {
			addSessionToParams(requestObject);
		});
	} else {
		addSessionToParams(request);
	}
}

/**
 * Send an HTTP error
 *
 * @param {Object}          jsonrpcServer   The jayson instance
 * @param {Object}          request         The JSON-RPC request
 * @param {ServerResponse}  res             The HTTP response
 * @param {string}          err             The error message
 * @param {number}          code            The HTTP error code
 * @param {Object}          headers         HTTP headers
 */
function respondError(jsonrpcServer, request, res, err, code, headers) {
	if (err && typeof err === 'object' && err.message) {
		err = err.message;
	}

	var body;
	if (Array.isArray(request)) {
		body = request.map(function (requestObject) {
			return buildErrorResponse(jsonrpcServer, requestObject,
				jayson.Server.errors.INTERNAL_ERROR, err);
		});
	} else {
		body = buildErrorResponse(jsonrpcServer, request,
			jayson.Server.errors.INTERNAL_ERROR, err);
	}
	res.writeHead(code, headers || {});
	res.end(JSON.stringify(body));
}

/**
 * Handle the JSON-RPC request returned by jayson
 *
 * @param {CommandCenter}   commandCenter
 * @param {Object}          jsonrpcServer   The jayson instance
 * @param {IncomingMessage} req             The HTTP request
 * @param {ServerResponse}  res             The HTTP response
 * @param {Error}           err             An error returned by jayson in case of failure
 * @param {Object}          request         The JSON-RPC request returned by jayson
 */
function handleJsonrpcRequest(commandCenter, jsonrpcServer, req, res, err, request) {
	// parsing failed, 500 server error
	if (err) {
		return respondError(jsonrpcServer, null, res, err.message, 500);
	}

	var options = jsonrpcServer.options;

	var headers = extractMageHeaders(req.headers);

	commandCenter.processHeaders(headers, function (err, session, callback) {
		if (err) {
			return respondError(jsonrpcServer, request, res, err, 401);
		}

		// Add the session to the params list to be used by the Command Center
		addSessionToRequest(request, session);

		jsonrpcServer.call(request, function (error, success) {
			var response = error || success;

			if (response) {
				utils.JSON.stringify(response, options, function (err, body) {
					if (err) {
						return respondError(jsonrpcServer, request, res, err, 400);
					}

					var headers = {
						'Content-Length': Buffer.byteLength(body, options.encoding),
						'Content-Type': 'application/json'
					};
					res.writeHead(200, headers);
					res.end(body);
				});
			} else {
				// no response received at all, must be a notification
				res.writeHead(204);
				res.end();
			}
			callback();
		});
	});
}

/**
 * Hooks up a command center to the HTTP server.
 *
 * @param {CommandCenter} commandCenter
 */
exports.register = function (commandCenter) {
	var httpServer = mage.core.httpServer;

	if (!httpServer) {
		throw new Error('No HTTP server available to register command center on.');
	}

	var jsonrpcServer = new jayson.Server({}, {
		router: createJsonrpcRouter(commandCenter)
	});

	function handler(req, res, path, urlInfo) {

		//  405 method not allowed if not POST
		if (!utils.isMethod(req, 'POST')) {
			return respondError(jsonrpcServer, null, res, 'Method not allowed', 405, { allow: 'POST' });
		}

		// 415 unsupported media type if Content-Type is not correct
		if (!utils.isContentType(req, 'application/json')) {
			return respondError(jsonrpcServer, null, res, 'Unsupported media type', 415);
		}

		var hookResponse = commandCenter.app.checkRequestHooks(req, path, urlInfo, 'command');
		if (hookResponse) {
			return respondError(jsonrpcServer, null, res, hookResponse.output, hookResponse.code, hookResponse.headers);
		}

		// Retrieve and parse the body of the request
		utils.parseBody(req, jsonrpcServer.options, function (err, request) {
			handleJsonrpcRequest(commandCenter, jsonrpcServer, req, res, err, request);
		});
	}

	httpServer.addRoute('/' + commandCenter.app.name + '/jsonrpc', handler, true);
};

/**
 * Receive external libraries
 *
 * @param {Object} mageInstance
 * @param {Object} mageLogger
 */
exports.setup = function (mageInstance, mageLogger) {
	mage = mageInstance;
	logger = mageLogger;
};
