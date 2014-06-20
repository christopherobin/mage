var mage;
var logger;

var jayson = require('jayson');
var utils = jayson.utils;

var MAGE_HEADER_FIELD = 'x-mage';

function getJsonrpcRouter(commandCenter) {
	return function (method, params) {

		// Extract the session from the params, then remove it
		var session = params.mageSession;
		delete params.mageSession;

		var cmd = {
			name: method,
			params: params
		};

		return function () {
			var callback = arguments[arguments.length - 1];

			if (!commandCenter.getCommandInfo(cmd.name)) {
				return callback(this.error(jayson.Server.errors.METHOD_NOT_FOUND));
			}

			commandCenter.executeCommand(cmd, session, callback);
		};
	};
}

function extractMageHeaders(requestHeaders) {
	var headers = [];

	Object.keys(requestHeaders)
		// Ignore the headers where the name is not prefixed with the MAGE header field name
		.filter(function (name) {
			return name.indexOf(MAGE_HEADER_FIELD) === 0;
		})
		// Create a new object with the filtered header fields
		// Remove the unused part from the header field names
		.forEach(function (idx) {
			var name = idx.replace(new RegExp('^' +  MAGE_HEADER_FIELD + '-(.*)$', 'i'), 'mage.$1');
			headers.push({
				name: name,
				key: requestHeaders[idx]
			});
		});

	return headers;
}

/**
 * Hooks up a command center to the HTTP server.
 *
 * @param {CommandCenter} commandCenter
 */
exports.register = function (commandCenter) {
	var httpServer = mage.core.msgServer.getHttpServer();

	if (!httpServer) {
		throw new Error('No HTTP server available to register command center on.');
	}

	var jsonrpcServer = new jayson.Server({}, {
		router: getJsonrpcRouter(commandCenter)
	});
	var options = jsonrpcServer.options;

	function handler(req, res, path, urlInfo) {

		// ends the request with an error code
		function respondError(err, code, headers) {
			res.writeHead(code, headers || {});
			if (typeof err === 'object' && err.message !== undefined) {
				err = err.message;
			} else if (typeof err !== 'string' && err.toString) {
				err = err.toString();
			}
			res.end(err);
		}

		//  405 method not allowed if not POST
		if (!utils.isMethod(req, 'POST')) {
			return respondError('Method not allowed', 405, { allow: 'POST' });
		}

		// 415 unsupported media type if Content-Type is not correct
		if (!utils.isContentType(req, 'application/json')) {
			return respondError('Unsupported media type', 415);
		}

		var hookResponse = commandCenter.getApp().checkRequestHooks(req, path, urlInfo, 'command');
		if (hookResponse) {
			return respondError(hookResponse.output, hookResponse.code, hookResponse.headers);
		}

		/**
		 * Handle the JSON-RPC request returned by jayson
		 *
		 * @param {Error}   err       An error returned by jayson in case of failure.
		 * @param {Object}  request   The JSON-RPC request returned by jayson.
		 */
		function handleJsonrpcRequest(err, request) {
			// parsing failed, 500 server error
			if (err) {
				return respondError(err, 500);
			}

			var headers = extractMageHeaders(req.headers);

			commandCenter.processHeaders(headers, jsonrpcServer, function (err, session, callback) {
				if (err) {
					return respondError(err, 401);
				}

				function addSessionToParams(requestObject) {
					if (!requestObject.params) {
						requestObject.params = {};
					}
					requestObject.params.mageSession = session;
				}

				// Add the session to the params list to be used by the Command Center
				if (Array.isArray(request)) {
					request.forEach(addSessionToParams);
				} else {
					addSessionToParams(request);
				}

				jsonrpcServer.call(request, function (error, success) {
					var response = error || success;

					if (response) {
						utils.JSON.stringify(response, options, function (err, body) {
							if (err) {
								return respondError(err, 400);
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

		// Retrieve and parse the body of the request
		utils.parseBody(req, options, handleJsonrpcRequest);
	}

	httpServer.addRoute('/' + commandCenter.getApp().getName() + '/jsonrpc', handler, true);
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
