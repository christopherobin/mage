var mage;
var logger;
var State;

var async = require('async');
var zlib = require('zlib');
var fs = require('fs');
var path = require('path');

var EventEmitter = require('events').EventEmitter;
var ResponseCache = require('./responseCache').ResponseCache;

var DEFAULT_RESPONSE_CACHE_TTL = 3 * 60;  // cache lifetime of the command response in seconds
var COMPRESSION_THRESHOLD = 4096;         // only gzip if the response is at least this many bytes uncompressed
var commandsDirName = 'usercommands';     // directory inside of module file space where user command implementations are expected
var cmdPathSplitter = '.';                // what separates the module name and command name

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
};


// CommandCenter implementation

function CommandCenter(app) {
	this.app = app;
	this.exposed = false;
	this.commands = {};
	this.userCommandTimeout = null;

	var ttl;
	var appConfig = mage.core.config.get('apps.' + app.name);

	if (appConfig && appConfig.hasOwnProperty('responseCache')) {
		ttl = appConfig.responseCache;
	} else {
		ttl = DEFAULT_RESPONSE_CACHE_TTL;
	}

	this.responseCache = new ResponseCache(app.name, ttl);
}

exports.CommandCenter = CommandCenter;


CommandCenter.prototype.expose = function () {
	logger.alert('CommandCenter.expose is no longer needed, please remove this call from your application.');
};


// The expose() function will make a set of commands available for execution (given requirements).
// If anything goes wrong, expose() will throw errors.

CommandCenter.prototype.setup = function () {
	if (this.exposed) {
		throw new Error('The "' + this.app.name + '" command center has already been exposed.');
	}

	var appAccess = this.app.access;
	var modNames = mage.listModules();

	var count = 0;

	logger.verbose('Exposing commands for app:', this.app.name);

	for (var i = 0; i < modNames.length; i++) {
		var modName = modNames[i];
		var modPath = mage.getModulePath(modName);

		if (!modPath) {
			throw new Error('Could not resolve path of module "' + modName + '".');
		}

		var files;

		try {
			files = fs.readdirSync(modPath + '/' + commandsDirName);
		} catch (error) {
			logger.verbose('Module', modName, 'has no user commands (skipping)');
			continue;
		}

		for (var j = 0; j < files.length; j++) {
			var cmdName = files[j];
			var cmdPath = modPath + '/' + commandsDirName + '/' + cmdName;

			if (path.extname(cmdName) !== '.js') {
				var stats = fs.statSync(cmdPath);

				if (!stats.isDirectory()) {
					// file is not a directory, nor a .js file, so ignore

					logger.verbose(cmdPath, 'is not a directory, nor a .js file (skipping)');
					continue;
				}
			}

			var cmd = require(cmdPath);  // require() may throw, which we like in this case

			var execPath = modName + cmdPathSplitter + cmdName;

			if (cmd.execute.length - 2 !== (cmd.params || []).length) {
				throw new Error('Command ' + execPath + ' has incorrectly configured params.');
			}

			var cmdAccess = cmd.access || mage.core.access.getHighestLevel();

			if (mage.core.access.compare(cmdAccess, appAccess) > 0) {
				// this command is not allowed to be exposed on this app

				logger.verbose('Not allowed to expose command', execPath, '(' + cmdAccess + ') on app:', this.app.name, '(' + appAccess + ') (skipping)');
				continue;
			}

			logger.verbose('Exposing command', execPath, 'at', cmdPath);

			this.commands[execPath] = {
				execPath: execPath,
				gameModule: modName,
				cmdName: cmdName,
				cmdPathSplitter: cmdPathSplitter,
				mod: cmd,
				access: cmdAccess
			};

			count += 1;
		}
	}

	logger.notice(count, 'commands exposed for app:', this.app.name);

	this.exposed = true;
};


CommandCenter.prototype.getModuleCommands = function (modName) {
	var result = {};

	for (var cmdPath in this.commands) {
		var parts = cmdPath.split(cmdPathSplitter);

		if (modName === parts[0]) {
			result[parts[1]] = this.commands[cmdPath];
		}
	}

	return result;
};


function processCommandHeader(state, headerData, paramsData, cb) {
	// cb: error, tags

	if (!headerData.length) {
		return state.error(null, 'No data in user command header.', cb);
	}

	var header;
	try {
		header = JSON.parse(headerData);
	} catch (e) {
		return state.error(null, 'Error parsing user command header: ' + headerData, cb);
	}

	var usedHooks = [];

	async.forEachSeries(
		header,
		function (entry, callback) {
			if (!entry || !entry.name) {
				return callback();
			}

			var fnHook = messageHooks[entry.name];

			if (!fnHook) {
				return state.error(null, 'Unknown hook type: ' + entry.name, callback);
			}

			usedHooks.push(entry.name);

			fnHook(state, entry, paramsData, callback);
		},
		function (error) {
			if (error) {
				// error while handling hooks (probably auth)

				return cb(error);
			}

			// some hooks may have caused mutations (eg: session touch), so distribute these first

			state.archivist.distribute(function (error) {
				if (error) {
					return cb(error);
				}

				// respond with a hooks list

				cb(null, { hooks: usedHooks });
			});
		}
	);
}


CommandCenter.prototype.isValidAccessLevel = function (level, commands) {
	for (var i = 0, len = commands.length; i < len; i++) {
		if (!commands[i] || !commands[i].name) {
			return false;
		}

		var cmdInfo = this.commands[commands[i].name];
		if (!cmdInfo) {
			return false;
		}

		if (mage.core.access.compare(level, cmdInfo.access) < 0) {
			return false;
		}
	}

	return true;
};


function serializeResponse(response) {
	if (response.errorCode) {
		return '[' + JSON.stringify(response.errorCode) + ']';
	}

	var out = '[null,' + (response.response || 'null');

	if (response.myEvents) {
		out += ',[' + response.myEvents.join(',') + ']';
	}

	out += ']';

	return out;
}


function postProcessCommandResponse(results, cb) {
	var content = '[' + results.join(',') + ']';
	var options = { mimetype: 'application/json; charset=utf-8' };

	var compress = content.length >= COMPRESSION_THRESHOLD;

	if (compress) {
		var startTime = Date.now();

		zlib.gzip(content, function (error, buf) {
			if (error) {
				logger.error('Failed to gzip command response of', content.length, 'chars');
				return cb(options, content);
			}

			logger.time('Gzipped command response of', content.length, 'chars down to', buf.length, 'bytes in', Date.now() - startTime, 'msec.');

			options.encoding = 'gzip';

			cb(options, buf);
		});
	} else {
		cb(options, content);
	}
}


CommandCenter.prototype._tryLoadCachedResponse = function (state, queryId, cb) {
	this.responseCache.get(state, queryId, cb);
};


CommandCenter.prototype._cacheResponse = function (state, queryId, options, response) {
	this.responseCache.set(state, queryId, options, response);
};


CommandCenter.prototype.setUserCommandTimeout = function (timeout) {
	this.userCommandTimeout = timeout;
};


CommandCenter.prototype._executeCommand = function (cmd, session, cb) {
	var cmdInfo = this.commands[cmd.name];
	if (!cmdInfo) {
		// command not registered in this command center

		logger.error('Attempt to execute unregistered user command:', cmd);

		return cb(null, '["server"]');
	}

	// set up state

	var state = new State();

	if (this.userCommandTimeout) {
		state.setTimeout(this.userCommandTimeout);
	}

	state.setDescription(cmd.name);

	if (session) {
		state.registerSession(session);
	}

	var that = this;

	state.archivist.createVault('client', 'client', { state: state }, function () {
		// execute the command

		logger.verbose('Executing command:', cmdInfo.execPath);

		var mod = cmdInfo.mod;
		var callParams = mod.params || [];

		var paramList = [state];

		for (var i = 0, len = callParams.length; i < len; i++) {
			paramList.push(cmd.params[callParams[i]]);
		}

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

				logger.info('User command', cmd.name, 'execution took', duration, 'msec.');
				exports.emit('completed', that.app, cmd, durationRaw);

				cb(null, serializeResponse(response));
			});
		});

		// call the execute function of the usercommand

		mod.execute.apply(mod, paramList);
	});
};


CommandCenter.prototype.executeCommands = function (commandNames, headerData, paramsData, files, queryId, transportInfo, transportCb) {
	// commandNames: ['obj.sync','actor.sync']
	// headerData: [{name:'mage.session',key:'abc'},{etc...}]
	// paramsData: [{ name: 'obj/sync', message: '{"abc":true}' }, ...]
	// queryId: if given, a number unique to this session, that identifies this request (used for caching)
	// transportInfo: { type: "http" / "https" / "websocket" / ... }

	var that = this;
	var state = new State();

	function cb(error, status) {
		state.close(function () {
			exports.emit('closePostConnection', that.app);

			transportCb(error, status);
		});
	}

	exports.emit('openPostConnection', this.app);
	var startTime = Date.now();

	// parse the parameter data

	var commandCount = commandNames.length;
	var commands = new Array(commandCount);

	try {
		var paramsLines = paramsData.split('\n');

		for (var i = 0; i < commandCount; i++) {
			var params = paramsLines[i] ? JSON.parse(paramsLines[i]) : {};

			if (files) {
				// replace file placeholder with the file data

				for (var fileId in files) {
					for (var key in params) {
						if (params[key] === fileId) {
							params[key] = files[fileId];
							delete files[fileId];
						}
					}
				}
			}

			commands[i] = {
				name: commandNames[i],
				params: params
			};
		}
	} catch (e) {
		logger.error
			.data('postdata', paramsData)
			.log('Parse error in command details');

		return cb(null, { httpStatusCode: 400 });   // 400: Bad request
	}


	// process the header

	processCommandHeader(state, headerData, paramsData, function (error, tags) {
		if (error) {
			// all errors during command header processing turn into HTTP auth errors

			var content;

			if (typeof error === 'object') {
				content = error.message;
			}

			return cb(content || '', { httpStatusCode: 401 });   // 401: Unauthorized
		}

		// there may be a session available now

		var session = state.session || null;

		// stack the transportType onto the tags for compliancy checks

		tags.transportInfo = transportInfo;

		// check if requirements for all commands have been met

		var validAccessLevel = that.isValidAccessLevel((session && session.meta) ? session.meta.access : 'anonymous', commands);

		if (!validAccessLevel) {
			logger.error('User command access level not satisfied.');

			return cb(null, { httpStatusCode: 401 });   // 401: Unauthorized
		}

		// try to load a previously cached response to this query

		that.responseCache.get(state, queryId, function (error, options, response) {
			if (!error && options && response) {
				// successful cache retrieval, return instantly

				logger.time('User command batch', commandNames, 'cached response load took', Date.now() - startTime, 'msec.');

				logger.warning
					.data('session', session ? session.getFullKey() : null)
					.log('Re-sending command response');

				return cb(response, options);
			}

			// start executing commands

			async.mapSeries(
				commands,
				function (cmd, callback) {
					that._executeCommand(cmd, session, callback);	// callback receives a serialized response string
				},
				function (error, results) {
					if (error) {
						// should never happen, since no error is fatal

						logger.error('Unreachable error reached in commandCenter.executeCommand callback');

						return cb(null, { httpStatusCode: 500 });   // 500: Internal service error
					}

					// turn results array into a reportable response (possibly gzipped)

					postProcessCommandResponse(results, function (options, content) {
						// cache the response

						that.responseCache.set(state, queryId, options, content);

						// send the response back to the client

						logger.time('User command batch', commandNames, 'execution took', Date.now() - startTime, 'msec.');

						logger.info
							.data({ commandNames: commandNames, queryId: queryId })
							.log('Executed and cached user commands', commandNames);

						cb(content, options);
					});
				}
			);
		});
	});
};