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
	var appConfig = mage.core.config.get(['apps', app.name]);

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
			var cmdFile = files[j];
			var cmdPath = modPath + '/' + commandsDirName + '/' + cmdFile;

			if (path.extname(cmdFile) !== '.js') {
				var stats = fs.statSync(cmdPath);

				if (!stats.isDirectory()) {
					// file is not a directory, nor a .js file, so ignore

					logger.verbose(cmdPath, 'is not a directory, nor a .js file (skipping)');
					continue;
				}
			}

			var cmdName = path.basename(cmdFile, '.js');
			var cmd = require(cmdPath);  // require() may throw, which we like in this case

			var execPath = modName + cmdPathSplitter + cmdName;

			if (typeof cmd.execute !== 'function') {
				throw new Error('Command ' + execPath + ' has no "execute" function.');
			}

			if (cmd.execute.length - 2 !== (cmd.params || []).length) {
				throw new Error('Command ' + execPath + ' has incorrectly configured params.');
			}

			var cmdAccess = cmd.access || mage.core.access.getHighestLevel();

			if (!mage.core.access.levelExists(cmdAccess)) {
				throw new Error('Command ' + execPath + ' has unrecognized access level: ' + cmdAccess);
			}

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


CommandCenter.prototype.setUserCommandTimeout = function (timeout) {
	this.userCommandTimeout = timeout;
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
	var cmdInfo = this.commands[cmd.name];
	if (!cmdInfo) {
		// command not registered in this command center

		logger.error('Attempt to execute unregistered user command:', cmd);

		return cb(null, serializeResponse({ errorCode: 'server' }));
	}

	// check if access level requirement has been met

	var level = 'anonymous';

	if (session && session.meta && session.meta.access) {
		level = session.meta.access;
	}

	if (mage.core.access.compare(level, cmdInfo.access) < 0) {
		logger.error('User command access level not satisfied for command "' + cmd.name + '" on app "' + this.app.name + '"');

		return cb(null, serializeResponse({ errorCode: 'auth' }));
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

	var that = this;

	state.archivist.createVault('client', 'client', { state: state }, function () {
		// execute the command

		logger.debug('Executing user command:', cmdInfo.execPath);

		var mod = cmdInfo.mod;

		var paramList = [state];

		if (mod.params) {
			for (var i = 0; i < mod.params.length; i++) {
				paramList.push(cmd.params[mod.params[i]]);
			}
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

				logger.info.data('durationMsec', 1000 * duration).log('Executed user command:', cmd.name);

				exports.emit('completed', that.app, cmd, durationRaw);

				cb(null, serializeResponse(response));
			});
		});

		// call the execute function of the usercommand

		mod.execute.apply(mod, paramList);
	});
};


function processCommandHeader(state, headerData, paramsData, cb) {
	// cb: error

	if (!headerData.length) {
		return state.error(null, 'No data in user command header.', cb);
	}

	var header;
	try {
		header = JSON.parse(headerData);
	} catch (e) {
		return state.error(null, 'Error parsing user command header: ' + headerData, cb);
	}

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

			fnHook(state, entry, paramsData, callback);
		},
		function (error) {
			if (error) {
				// error while handling hooks (probably auth)

				return cb(error);
			}

			// some hooks may have caused mutations (eg: session touch), so distribute these first

			state.archivist.distribute(cb);
		}
	);
}


function resolveFilesInParams(params, files) {
	// replace file placeholder with the file data

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


function parseCommands(commandNames, paramsData, files) {
	var commandCount = commandNames.length;
	var commands = new Array(commandCount);
	var currentLine = '';

	try {
		var paramsLines = paramsData.split('\n');

		for (var i = 0; i < commandCount; i++) {
			currentLine = paramsLines[i];

			var params = currentLine ? JSON.parse(currentLine) : {};

			if (files) {
				resolveFilesInParams(params, files);
			}

			commands[i] = {
				name: commandNames[i],
				params: params
			};
		}

		return commands;
	} catch (e) {
		logger.error
			.data('currentLine', currentLine)
			.data('postdata', paramsData)
			.log('Error while trying to parse user command data:', e);
	}
}


/**
 * Executes a batch of commands in series, each in their isolated environment.
 *
 * @param {string[]} commandNames The names of each command to execute.
 * @param {string}   headerData   Serialized JSON that contains information for message hooks to process.
 * @param {string}   paramsData   A newline (\n) separated collection of JSON strings that contain user command parameters.
 * @param {Object}   files        A key/value map where the key is the part-name of the upload, the value is: { data, partName, fileName, type }.
 * @param {string}   [queryId]    A unique ID for this request, useful for caching.
 * @param {Function} transportCb  A callback to the transport that takes content and meta data.
 */

CommandCenter.prototype.executeCommands = function (commandNames, headerData, paramsData, files, queryId, transportCb) {
	var that = this;
	var state = new State();
	state.appName = this.app.name;

	exports.emit('openPostConnection', this.app);

	function cb(content, options) {
		state.close(function () {
			exports.emit('closePostConnection', that.app);

			transportCb(content, options);
		});
	}

	// time the batch

	var startTime = process.hrtime();

	// parse the commands and parameters

	var commands = parseCommands(commandNames, paramsData, files);

	if (!commands) {
		return cb(null, { httpStatusCode: 400 });   // 400: Bad request
	}

	// process the header

	processCommandHeader(state, headerData, paramsData, function (error) {
		if (error) {
			// all errors during command header processing turn into HTTP auth errors

			return cb(error.message || '', { httpStatusCode: 401 });   // 401: Unauthorized
		}

		// there may be a session available now

		var session = state.session;

		// try to load a previously cached response to this query

		that.responseCache.get(state, queryId, function (error, options, response) {
			if (!error && options && response) {
				// successful cache retrieval, return instantly

				var durationRaw = process.hrtime(startTime);
				var duration = durationRaw[0] + durationRaw[1] / 1e9;

				logger.time('User command batch', commandNames, 'cached response load took', 1000 * duration, 'msec.');

				logger.warning
					.data('session', session ? session.getFullKey() : null)
					.log('Re-sending command response');

				return cb(response, options);
			}

			// start executing commands

			async.mapSeries(
				commands,
				function (cmd, callback) {
					that.executeCommand(cmd, session, callback);	// callback receives a serialized response string
				},
				function (error, results) {
					if (error) {
						// should never happen, since no error is fatal

						logger.error('Unreachable error reached in commandCenter.executeCommand callback:', error);

						return cb(null, { httpStatusCode: 500 });   // 500: Internal service error
					}

					// turn results array into a reportable response (possibly gzipped)

					postProcessCommandResponse(results, function (options, content) {
						// cache the response

						var cached = that.responseCache.set(state, queryId, options, content);

						// send the response back to the client

						var msg = cached ? 'Executed and cached user command batch' : 'Executed user command batch (could not cache)';

						var durationRaw = process.hrtime(startTime);
						var duration = durationRaw[0] + durationRaw[1] / 1e9;

						logger.debug
							.data({ commandNames: commandNames, queryId: queryId, durationMsec: duration * 1000 })
							.log(msg, commandNames);

						cb(content, options);
					});
				}
			);
		});
	});
};
