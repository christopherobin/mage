var MultipartParser = require('multipart-parser');

var mage;
var logger;


/**
 * Replace file placeholders in params with actual file data.
 *
 * @param {Object} params
 * @param {Object} files
 */

function resolveFilesInParams(params, files) {
	var fileIds = Object.keys(files || {});

	var fileCount = fileIds.length;
	if (fileCount === 0) {
		return;
	}

	// scan all members for files, and collect children

	function addMembers(list, obj) {
		var keys = Object.keys(obj || {});

		for (var i = 0; i < keys.length; i++) {
			list.push({
				owner: obj,
				key: keys[i],
				value: obj[keys[i]]
			});
		}
	}

	var list = [];

	addMembers(list, params);

	for (var i = 0; i < list.length && fileCount > 0; i++) {
		var member = list[i];

		if (!member.value) {
			continue;
		}

		var type = typeof member.value;

		if (type === 'object') {
			// append children to the end of the list

			addMembers(list, member.value);
		} else if (type === 'string' && files[member.value]) {
			// file found for this property, so assign it

			var file = files[member.value];

			logger.verbose('Accepted file', '"' + file.partName + '":', file.fileName);

			member.owner[member.key] = file;

			delete files[member.value];
			fileCount -= 1;
		}
	}
}


/**
 * Parses the uploaded data and files into a batch object
 *
 * @param {string} fullPath   The full path of the HTTP request.
 * @param {string} cmdData    The POST data that contains the command parameters.
 * @param {Object} [files]    Any uploaded files.
 * @returns {Object}          The batch.
 */

function parseBatchData(fullPath, cmdData, files) {
	if (typeof fullPath !== 'string') {
		throw new TypeError('Path is not a string');
	}

	var commandNames = fullPath.substr(fullPath.lastIndexOf('/') + 1).split(',');
	var commandCount = commandNames.length;
	var commands = new Array(commandCount);

	// split the string into lines

	cmdData = cmdData.split('\n');

	// line 0 is the header

	var header = JSON.parse(cmdData[0]);
	if (!Array.isArray(header)) {
		throw new TypeError('Parse error on batch header (JSON array expected): ' + cmdData[0]);
	}

	for (var i = 0; i < commandCount; i++) {
		var params = JSON.parse(cmdData[i + 1]) || {}; // +1 to offset the header at index 0

		if (files) {
			resolveFilesInParams(params, files);
		}

		commands[i] = {
			name: commandNames[i],
			params: params
		};
	}

	return {
		header: header,
		commands: commands,
		commandNames: commandNames  // useful for logging
	};
}


/**
 * Streams and parses a multipart request
 *
 * @param {Object}   req       The HTTP request.
 * @param {string}   boundary  The boundary between the parts.
 * @param {Function} cb        Callback on completion.
 */

function parseMultipart(req, boundary, cb) {
	// multipart, the first part has to be the same format as single part post data

	var parser = MultipartParser.create(boundary);
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

		logger.verbose('Receiving multipart-part:', partName);

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

	// It has been observed that the "end" event on the parser would fire more than once. This might
	// be related to Node.js 0.10 streams. To avoid the situation, we use once('end') instead of
	// on('end').

	parser.once('end', function () {
		logger.verbose('Finished reading multipart', req.method, 'request.');

		cb(null, cmdData, files);
	});

	// pipe all incoming data straight into the multipart parser

	req.pipe(parser);
}


/**
 * Streams and parses a singlepart request
 *
 * @param {Object}   req       The HTTP request.
 * @param {Function} cb        Callback on completion.
 */

function parseSinglepart(req, cb) {
	// single part

	req.setEncoding('utf8');

	var cmdData = '';

	req.on('data', function (chunk) {
		cmdData += chunk;
	});

	req.on('end', function () {
		logger.verbose('Finished reading', req.method, 'request.');

		cb(null, cmdData, null);
	});
}


/**
 * Streams and parses an HTTP request by calling into parseSinglepart or parseMultipart.
 *
 * @param {Object}   req       The HTTP request.
 * @param {Function} cb        Callback on completion.
 */

function parseHttpBody(req, cb) {
	// check for multipart streams that can contain file uploads

	var contentType = req.headers['content-type'];
	var m = contentType && contentType.match(/^multipart\/form-data; boundary=(.+)$/);

	if (m && m[1]) {
		parseMultipart(req, m[1], cb);
	} else {
		parseSinglepart(req, cb);
	}
}


/**
 *
 *
 * @param {Object}   req       The HTTP request.
 * @param {string}   fullPath  The full path of the HTTP request.
 * @param {Function} cb        Callback on completion.
 */

function parseBatchRequest(req, fullPath, cb) {
	// create a list of encodings that the client accepts

	var acceptedEncodings = req.headers['accept-encoding'];
	if (acceptedEncodings) {
		acceptedEncodings = acceptedEncodings.split(/\s*,\s*/);
	} else {
		acceptedEncodings = [];
	}

	// POST data contains parameters and possibly uploaded files

	parseHttpBody(req, function (error, batchData, files) {
		if (error) {
			return cb(error);
		}

		var batch;

		try {
			batch = parseBatchData(fullPath, batchData, files);
		} catch (parseError) {
			return cb(parseError);
		}

		cb(null, acceptedEncodings, batch);
	});
}


/**
 * Sends an HTTP response, and injects a "Pragma: no-cache" header.
 *
 * @param {Object}        res       The HTTP response object.
 * @param {number}        httpCode  The HTTP status code.
 * @param {Object}        [headers] The HTTP response headers.
 * @param {string|Buffer} body      The HTTP response body.
 */
function respond(res, httpCode, headers, body) {
	headers = headers || {};
	headers.pragma = 'no-cache';

	res.writeHead(httpCode, headers);
	res.end(body);
}


/**
 * Hooks up a command center to the HTTP server. After successfully parsing a batch request, it will
 * call executeBatch() on the command center.
 *
 * @param {CommandCenter} commandCenter
 */
exports.register = function (commandCenter) {
	var httpServer = mage.core.httpServer;

	if (!httpServer) {
		throw new Error('No HTTP server available to register command center on.');
	}


	function handler(req, res, path, query, urlInfo) {
		// deal with HEAD requests

		if (req.method === 'HEAD') {
			logger.verbose.data(req).log('Responding 200 to HEAD request');

			return respond(res, 200);
		}

		// check if this client is allowed to do this request

		var hookResponse = commandCenter.app.checkRequestHooks(req, path, urlInfo, 'command');
		if (hookResponse) {
			return respond(res, hookResponse.code, hookResponse.headers, hookResponse.output);
		}

		// pull the optional queryId from the URL querystring

		var queryId = query.queryId || null;

		// parse commands

		parseBatchRequest(req, path, function (error, acceptedEncodings, batch) {
			if (error) {
				logger.error.data(req).log(error);

				return respond(res, 400);  // 400: Bad request
			}

			// run the batch

			commandCenter.executeBatch(acceptedEncodings, batch, queryId, function (error, content, options) {
				if (error) {
					// turn all errors into 401: Unauthorized
					return respond(res, 401);
				}

				// only strings and buffers allowed

				if (content && typeof content !== 'string' && !Buffer.isBuffer(content)) {
					logger.alert('CommandCenter.executeBatch yielded non-string/buffer value:', content);

					return respond(res, 500);	// 500: Internal server error
				}

				var headers = {};

				if (options) {
					if (options.mimetype) {
						headers['content-type'] = options.mimetype;
					}

					if (options.encoding) {
						headers['content-encoding'] = options.encoding;
					}
				}

				// send the command response back to the client with 200: OK

				respond(res, 200, headers, content);
			});
		});
	}

	httpServer.addRoute(new RegExp('^/' + commandCenter.app.name + '/'), handler, true);
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
