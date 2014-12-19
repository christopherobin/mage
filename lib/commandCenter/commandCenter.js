var assert = require('assert');
var async = require('async');
var zlib = require('zlib');
var fs = require('fs');
var path = require('path');

var EventEmitter = require('events').EventEmitter;
var ResponseCache = require('./responseCache').ResponseCache;
var httpBatchHandler = require('./httpBatchHandler');
var jsonrpcBatchHandler = require('./jsonrpcBatchHandler');

var mage;
var logger;
var State;

var DEFAULT_RESPONSE_CACHE_TTL = 3 * 60;  // cache lifetime of the command response in seconds
var COMPRESSION_THRESHOLD = 4096;         // only gzip if the response is at least this many bytes uncompressed
var COMMANDS_DIR_NAME = 'usercommands';     // user command directory inside of module file space
var COMMAND_PATH_SPLITTER = '.';                // what separates the module name and command name
var CONTENT_TYPE_JSON = 'application/json; charset=UTF-8';

exports = module.exports = new EventEmitter();


// message hooks

var messageHooks = {};

exports.registerMessageHook = function (type, fn) {
	messageHooks[type] = fn;
};


/**
 * To allow flexibility for testing, some objects are passed in with initialize.
 *
 * @param {Object}   mageInstance A mage instance.
 * @param {Object}   mageLogger   A mage logger.
 * @param {Function} State        The state constructor.
 */

exports.initialize = function (mageInstance, mageLogger, stateConstructor) {
	mage = mageInstance;
	logger = mageLogger;
	State = stateConstructor;

	jsonrpcBatchHandler.setup(mageInstance, mageLogger);
	httpBatchHandler.setup(mageInstance, mageLogger);
};


// CommandCenter implementation

function CommandCenter(app) {
	this.app = app;
	this.exposed = false;
	this.commands = {};
	this.userCommandTimeout = null;

	var ttl;
	var appConfig = mage.core.config.get(['apps', app.name]);

	if (appConfig && appConfig.hasOwnProperty('responseCache')) {
		ttl = appConfig.responseCache;
	} else {
		ttl = DEFAULT_RESPONSE_CACHE_TTL;
	}

	this.responseCache = new ResponseCache(app.name, ttl);
}

exports.CommandCenter = CommandCenter;


CommandCenter.prototype.setupUserCommand = function (modName, cmdFile) {
	var modPath = mage.getModulePath(modName);
	var cmdPath = modPath + '/' + COMMANDS_DIR_NAME + '/' + cmdFile;

	if (path.extname(cmdFile) !== '.js') {
		var stats = fs.statSync(cmdPath);

		if (!stats.isDirectory()) {
			// file is not a directory, nor a .js file, so ignore

			return logger.verbose(cmdPath, 'is not a directory, nor a .js file (skipping)');
		}
	}

	var cmdName = path.basename(cmdFile, '.js');
	var cmd = require(cmdPath);  // require() may throw, which we like in this case

	var execPath = modName + COMMAND_PATH_SPLITTER + cmdName;

	var cmdAccess = cmd.access || mage.core.access.getHighestLevel();

	// To avoid really long lines we assign this to a variable.
	var errorString = 'Command ' + execPath + ' has no "execute" function.';
	assert.strictEqual(typeof cmd.execute, 'function', errorString);

	errorString = 'Command ' + execPath + ' has incorrectly configured params.';
	assert.strictEqual(cmd.execute.length - 2, (cmd.params || []).length, errorString);

	errorString = 'Command ' + execPath + ' has unrecognized access level: ' + cmdAccess;
	assert(mage.core.access.levelExists(cmdAccess), errorString);

	var appAccess = this.app.access;

	if (mage.core.access.compare(cmdAccess, appAccess) > 0) {
		// this command is not allowed to be exposed on this app

		return logger.verbose(
			'Not allowed to expose command', execPath, '(' + cmdAccess + ')',
			'on app:', this.app.name, '(' + appAccess + ') (skipping)'
		);
	}

	logger.verbose('Exposing command', execPath, 'at', cmdPath);

	this.commands[execPath] = {
		execPath: execPath,
		gameModule: modName,
		cmdName: cmdName,
		cmdPathSplitter: COMMAND_PATH_SPLITTER,
		mod: cmd,
		access: cmdAccess
	};
};

CommandCenter.prototype.setupMod = function (modName, cb) {
	var modPath = mage.getModulePath(modName);

	if (!modPath) {
		return setImmediate(function () {
			cb(new Error('Could not resolve path of module "' + modName + '".'));
		});
	}

	var that = this;

	fs.readdir(modPath + '/' + COMMANDS_DIR_NAME, function (error, files) {
		if (error) {
			return cb(error);
		}

		for (var i = 0; i < files.length; i += 1) {
			try {
				that.setupUserCommand(modName, files[i]);
			} catch (e) {
				return cb(e);
			}
		}

		cb();
	});
};


// The setup function will make a set of commands available for execution.

CommandCenter.prototype.setup = function (cb) {
	if (this.exposed) {
		return cb(new Error('The "' + this.app.name + '" command center has already been exposed.'));
	}

	logger.verbose('Exposing commands for app:', this.app.name);

	var modNames = mage.listModules();
	var that = this;

	async.eachLimit(modNames, 5, function (modName, callback) {
		that.setupMod(modName, callback);
	}, function (error) {
		if (error) {
			return cb(error);
		}

		logger.notice('Exposed usercommands for app:', that.app.name);

		jsonrpcBatchHandler.register(that);

		// The httpBatchHandler must be the last to register its routes
		// TODO: Explain why this is so.

		httpBatchHandler.register(that);

		that.exposed = true;

		cb();
	});
};

/**
 * Return the list of the commands provided by the given module.
 *
 * @param   {string}    modName   The name of the module, you want to get the list of function
 * @returns {Object{}}  List of commands
 */

CommandCenter.prototype.getModuleCommands = function (modName) {
	var result = {};

	for (var cmdPath in this.commands) {
		var parts = cmdPath.split(COMMAND_PATH_SPLITTER);

		if (modName === parts[0]) {
			result[parts[1]] = this.commands[cmdPath];
		}
	}

	return result;
};


CommandCenter.prototype.getPublicConfig = function (baseUrl) {
	var cfg = {
		url: baseUrl + '/' + this.app.name,
		cors: mage.core.httpServer.getCorsConfig(),
		timeout: 15000,
		commands: {}
	};

	var execPaths = Object.keys(this.commands);
	for (var i = 0; i < execPaths.length; i += 1) {
		var execPath = execPaths[i];
		var cmd = this.commands[execPath];

		if (!cfg.commands[cmd.gameModule]) {
			cfg.commands[cmd.gameModule] = [];
		}

		cfg.commands[cmd.gameModule].push({
			name: cmd.cmdName,
			params: cmd.mod.params
		});
	}

	return cfg;
};


/**
 * Serializes a single command response into a string.
 *
 * @param   {*} response   The unserialized response.
 * @returns {string}       The serialized response.
 */

function serializeCommandResult(response) {
	var out = [];

	out.push(JSON.stringify(response.errorCode || null));

	out.push(JSON.stringify(response.response === undefined ? null : response.response));

	if (response.myEvents && response.myEvents.length) {
		out.push('[' + response.myEvents.join(',') + ']');
	}

	return '[' + out.join(',') + ']';
}


/**
 * Checks if the given content should be compressed or not.
 *
 * @param {string}   content
 * @param {string[]} acceptedEncodings
 * @returns {boolean}
 */
function shouldCompress(content, acceptedEncodings) {
	return content.length >= COMPRESSION_THRESHOLD && acceptedEncodings.indexOf('gzip') !== -1;
}


/**
 * GZIPs a string or buffer.
 *
 * @param {string|Buffer} content
 * @param {Function} cb
 */

function compress(content, cb) {
	var startTime = process.hrtime();

	zlib.gzip(content, function (error, buf) {
		if (error) {
			logger.error('Failed to gzip command response of', content.length, 'chars:', error);
			return cb(error);
		}

		var durationRaw = process.hrtime(startTime);
		var duration = durationRaw[0] + durationRaw[1] / 1e9;

		logger.debug(
			'Gzipped command batch response of', content.length, 'chars down to',
			buf.length, 'bytes in', duration * 1000, 'msec.'
		);

		cb(null, buf);
	});
}


CommandCenter.prototype.setUserCommandTimeout = function (timeout) {
	this.userCommandTimeout = timeout;
};

/**
 * Return the information about the given command, or undefined if it does not exist.
 *
 * @param   {string}    cmdName       Name of the command
 * @returns {Object}    Command information
 */

CommandCenter.prototype.getCommandInfo = function (cmdName) {
	return this.commands[cmdName];
};

/**
 * Build the param list to pass to the user command function
 *
 * If the given params are an Object, the object will be filtered to keep only
 * the fields with the key specified in the user module.
 *
 * If the params are an Array, the missing parameters will be added with undefined as value.
 * So that the built parameter list will have the expected length.
 * If two many parameters are provided, an exception will be thrown.
 *
 * @param {string[]}    cmdInfoModParams  Parameters information from the user module
 * @param {Object}      cmdParams         Parameters to pass to the user command function
 * @returns {Array}     Built parameter list
 * @throws  {Error}     Will throw an error if there are too many parameters provided.
 */
CommandCenter.prototype.buildParamList = function (cmdInfoModParams, cmdParams) {
	if (!cmdInfoModParams) {
		return [];
	}

	var paramList = [];

	if (Array.isArray(cmdParams)) {
		if (cmdParams.length  >  cmdInfoModParams.length) {
			throw new Error('Too many parameters provided.');
		}
		paramList = cmdParams;
		while (paramList.length < cmdInfoModParams.length) {
			paramList.push(undefined);
		}
	} else {
		for (var i = 0; i < cmdInfoModParams.length; i++) {
			paramList.push(cmdParams[cmdInfoModParams[i]]);
		}
	}

	return paramList;
};


/**
 * Executes a single user command in isolation (ie: it will have its own State instance). Errors,
 * events and responses are serialized and returned to the callback. Before execution, the access
 * level will be checked for validity.
 *
 * @param {Object}   cmd        A command object.
 * @param {string}   cmd.name   The name of the command.
 * @param {Object}   cmd.params A key/value map of parameter names and their values.
 * @param {Session}  [session]  An optional Session instance
 * @param {Function} cb
 */

CommandCenter.prototype.executeCommand = function (cmd, session, cb) {
	var cmdInfo = this.getCommandInfo(cmd.name);
	if (!cmdInfo) {
		// command not registered in this command center

		logger.error('Attempt to execute unregistered user command:', cmd);

		return cb(null, { errorCode: 'server' });
	}

	// set up state

	var state = new State();
	state.appName = this.app.name;

	if (this.userCommandTimeout) {
		state.setTimeout(this.userCommandTimeout);
	}

	state.setDescription(cmd.name);

	if (session) {
		state.registerSession(session);
	}

	// check if access level requirement has been met

	if (!state.canAccess(cmdInfo.access)) {
		var errorText = 'User command access level not satisfied for command "' + cmd.name +
			'" on app "' + this.app.name + '". Access level required is "' + cmdInfo.access +
			'" but user access level is "' + state.access + '".';

		logger.info(errorText);

		return state.error('auth', null, function () {
			// close the state and send the response

			state.close(function (closeError, response) {
				cb(null, response);
			});
		});
	}

	var that = this;

	state.archivist.createVault('client', 'client', { state: state }, function () {
		// execute the command

		logger.debug('Executing user command:', cmdInfo.execPath);

		var mod = cmdInfo.mod;

		var paramList;

		try {
			paramList = that.buildParamList(mod.params, cmd.params);
		} catch (err) {
			return cb(err);
		}

		paramList.unshift(state);

		// time the user command

		var startTime = process.hrtime();

		// add the final callback on the params list

		paramList.push(function () {
			// note: we may not expect an error parameter, the error state should now be known by the state object

			// close the state:
			// - commits and sends events to other players, or:
			// - rolls back

			state.close(function (closeError, response) {
				// use the gathered errors, response, events on the state object to build response JSON for the client
				// at this time, state.close() never returns a closeError.

				var durationRaw = process.hrtime(startTime);
				var duration = durationRaw[0] + durationRaw[1] / 1e9;

				logger.info
					.data({
						durationMsec: 1000 * duration,
						commandName: cmd.name,
						actorId: state.actorId
					})
					.log('Executed user command:', cmd.name);

				exports.emit('completed', that.app, cmd, durationRaw);

				cb(null, response);
			});
		});

		// call the execute function of the usercommand

		mod.execute.apply(mod, paramList);
	});
};


/**
 * Calls all message hooks required for a batch.
 *
 * @param {State}    state  MAGE state object.
 * @param {Object}   batch  Command batch object.
 * @param {Function} cb     Callback on completion.
 */

function processBatchHeader(state, batch, cb) {
	if (batch.header.length === 0) {
		return cb();
	}

	async.eachSeries(
		batch.header,
		function (entry, callback) {
			if (!entry || !entry.name) {
				return callback();
			}

			var fnHook = messageHooks[entry.name];

			if (!fnHook) {
				return state.error(null, 'Unknown hook type: ' + entry.name, callback);
			}

			fnHook(state, entry, batch.commands, callback);
		},
		function (error) {
			if (error) {
				// error while handling hooks (probably parse errors)

				return cb(error);
			}

			// some hooks may have caused mutations (eg: session touch), so distribute these first

			state.archivist.distribute(cb);
		}
	);
}


/**
 * Executes a batch of commands in series, each in their isolated environment.
 *
 * @param {string[]} acceptedEncodings  A list of compression formats that are allowed to be used.
 * @param {Object}   batch              The batch containing the header and the commands with their parameters.
 * @param {string}   [queryId]          A unique ID for this request, useful for caching.
 * @param {Function} transportCb        A callback to the transport that takes content and meta data.
 */

CommandCenter.prototype.executeBatch = function (acceptedEncodings, batch, queryId, transportCb) {
	var that = this;
	var startTime = process.hrtime();

	var state = new State();

	state.appName = this.app.name;

	exports.emit('openPostConnection', this.app);

	function cb(error, content, options) {
		state.close(function () {
			exports.emit('closePostConnection', that.app);

			transportCb(error, content, options);
		});
	}

	function duration() {
		var durationRaw = process.hrtime(startTime);
		var durationSec = durationRaw[0] + durationRaw[1] / 1e9;

		return durationSec * 1000;
	}

	// process the header

	processBatchHeader(state, batch, function (error) {
		if (error) {
			// The batch cannot be processed (parse errors, etc)
			return cb(error);
		}

		// there may be a session available now

		var session = state.session;

		var headerEvents = state.myEvents;

		// try to load a previously cached response to this query

		that.responseCache.get(state, queryId, function (error, options, content) {
			if (!error && options && content) {
				// successful cache retrieval, return instantly

				logger.warning
					.data({
						batch: batch.commandNames,
						session: session ? session.getFullKey() : null,
						durationMsec: duration(),
						options: options,
						dataSize: content.length
					})
					.log('Re-sending command response');

				return cb(null, content, options);
			}

			// start executing commands and build a serialized output response

			function respond(options, content) {
				// cache the response

				var cached = that.responseCache.set(state, queryId, options, content);

				// send the response back to the client

				cb(null, content, options);

				// log the execution time

				var msg = cached ?
					'Executed and cached user command batch' :
					'Executed user command batch (could not cache)';

				logger.debug
					.data({
						batch: batch.commandNames,
						queryId: queryId,
						durationMsec: duration(),
						options: options,
						dataSize: content.length
					})
					.log(msg);
			}

			// recursively runs each command, until done, then calls respond

			function runCommand(output, cmdIndex) {
				var cmd = batch.commands[cmdIndex];
				if (cmd) {
					return that.executeCommand(cmd, session, function (error, response) {
						if (error) {
							// should never happen
							return cb(error);
						}

						if (headerEvents && headerEvents.length) {
							response.myEvents = response.myEvents || [];
							response.myEvents = headerEvents.concat(response.myEvents);
							headerEvents = null;
						}

						output += (output ? ',' : '[') + serializeCommandResult(response);

						runCommand(output, cmdIndex + 1);
					});
				}

				// close the output JSON array

				output += ']';

				// turn results array into a reportable response (possibly gzipped)

				var options = {
					mimetype: CONTENT_TYPE_JSON
				};

				if (!shouldCompress(output, acceptedEncodings)) {
					return respond(options, output);
				}

				return compress(output, function (error, compressed) {
					if (error) {
						// error during compression, send the original
						respond(options, output);
					} else {
						options.encoding = 'gzip';

						respond(options, compressed);
					}
				});
			}

			runCommand('', 0);
		});
	});
};

/**
 * Process the headers and attach the session object to the given server
 *
 * @param {Object} headers     The MAGE headers extracted from the request
 * @param {Function} callback  Return the session and a function to call to close the state
 */

CommandCenter.prototype.processHeaders = function (headers, callback) {
	var state = new State();
	state.appName = this.app.name;

	processBatchHeader(state, {
		header: headers
	}, function (error) {
		if (error) {
			state.close(function () {
				return callback(error);
			});
			return;
		}

		function cb() {
			state.close();
		}

		return callback(null, state.session, cb);
	});
};
