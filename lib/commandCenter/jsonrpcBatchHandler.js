var mage;
var logger;

var jayson = require('jayson');
var Utils = jayson.Utils;


function getJsonrpcRouter(commandCenter) {
	return function (method, params) {
		var cmd = {
			name: method,
			params: params
		};
		return function () {
			var callback = arguments[arguments.length - 1];

			if (!commandCenter.getCommandInfo(cmd.name)) {
				return callback(this.error(-32601));
			}

			var session = this.mageSession;
			commandCenter.executeCommand(cmd, session, callback);
		};
	};
}

function extractMageHeaders(requestHeaders) {
	var headers = [];

	Object.keys(requestHeaders)
		// Ignore the headers where the name isn't X-MAGE-*
		.filter(function (name) {
			return name.toUpperCase().indexOf('X-MAGE-') === 0;
		})
		// Create a new object with the filtered header fields
		// Remove the X-MAGE- string from the header field names
		.forEach(function (idx) {
			var name = idx
				.replace(/^X-MAGE/i, 'mage')
				.toLowerCase()
				.replace('-', '.');
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
		if (!Utils.isMethod(req, 'POST')) {
			return respondError('Method not allowed', 405, { allow: 'POST' });
		}

		// 415 unsupported media type if Content-Type is not correct
		if (!Utils.isContentType(req, 'application/json')) {
			return respondError('Unsupported media type', 415);
		}

		var hookResponse = commandCenter.app.checkRequestHooks(req, path, urlInfo, 'command');
		if (hookResponse) {
			return respondError(hookResponse.output, hookResponse.code, hookResponse.headers);
		}

		Utils.parseBody(req, options, function (err, request) {
			// parsing failed, 500 server error
			if (err) {
				return respondError(err, 500);
			}

			var headers = extractMageHeaders(req.headers);

			commandCenter.processHeaders(headers, jsonrpcServer, function (err, callback) {
				if (err) {
					return respondError(err, 401);
				}

				jsonrpcServer.call(request, function (error, success) {
					var response = error || success;

					if (response) {
						Utils.JSON.stringify(response, options, function (err, body) {
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
		});
	}

	httpServer.addRoute(new RegExp('^/' + commandCenter.app.name + '/jsonrpc$'), handler, true);
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
