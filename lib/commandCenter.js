var mithril = require('./mithril'),
    async = require('async'),
    Memcached = require('memcached'),
    logger = mithril.core.logger,
    State = require('./state').State;


var commandsDirName = 'usercommands';			// directory inside of module file space where user command implementations are expected
var cmdPathSplitter = '.';						// what separates the module name and command name


// message hooks

var messageHooks = {};

exports.registerMessageHook = function (type, fn) {
	messageHooks[type] = fn;
};


// cache for memcaching command responses

var mcClient, mcPrefix;

function getMemcachedClient() {
	if (mcClient) {
		return mcClient;
	}

	if (mcClient === false) {
		logger.debug('Response cache disabled (missing configuration)');
		return null;
	}

	var config = mithril.core.config.get('data.kvcache');

	if (!config) {
		// mark as unconfigured feature

		logger.error('No memcached server configured for user command response caching.');
		mcClient = false;
		return null;
	}

	mcPrefix = config.prefix || '';
	mcClient = new Memcached(config.hosts, config.options || {});

	mcClient.on('failure', function (details) {
		logger.error('Membase server went down', JSON.stringify(details));
	});

	mcClient.on('reconnecting', function (details) {
		logger.error('Reconnecting to Membase server', JSON.stringify(details));
	});

	mcClient.on('reconnected', function (details) {
		logger.error('Reconnected to Membase server', JSON.stringify(details));
	});

	mcClient.on('issue', function (details) {
		logger.error('Issue occured on Membase server', JSON.stringify(details));
	});

	mcClient.on('remove', function (details) {
		logger.error('Membase server removed from cluster', JSON.stringify(details));
	});

	return mcClient;
}


mithril.on('shutdown', function () {
	if (mcClient) {
		mcClient.end();
		mcClient = false;
	}
});


function createResponseCacheKeys(session) {
	if (!session) {
		logger.debug('No session, so could not create response cache keys');

		return null;
	}

	var sessionKey = session.getFullKey();
	if (!sessionKey) {
		logger.debug('No registered session key, so could not create response cache keys');

		return null;
	}

	var keys = {
		info: 'cmdresponse/info/' + sessionKey,
		data: 'cmdresponse/data/' + sessionKey
	};

	if (mcPrefix) {
		keys.info = mcPrefix + '/' + keys.info;
		keys.data = mcPrefix + '/' + keys.data;
	}

	return keys;
}


// CommandCenter implementation

function CommandCenter(app) {
	this.app = app;
	this.commands = {};
	this.responseCacheTTL = 3 * 60;     // cache lifetime of the command response in seconds. 0 means no cache.
}

exports.CommandCenter = CommandCenter;


CommandCenter.prototype.expose = function (requirements, commandList) {
	var count = 0;

	for (var gameModule in commandList) {
		var cmds = commandList[gameModule];

		for (var i = 0, len = cmds.length; i < len; i++) {
			var cmdName = cmds[i];

			var cmd = this.commands[gameModule + cmdPathSplitter + cmdName];
			if (cmd) {
				// user command was already exposed, so we augment the requirements list with an alternative requirement

				logger.error('Trying to expose command "' + gameModule + cmdPathSplitter + cmdName + '" twice on "' + this.app.name + '" command center. Ignoring.');
				continue;
			}

			if (!mithril[gameModule]) {
				return mithril.fatalError('Game module "' + gameModule + '" not found.');
			}

			var modPath = mithril.getModulePath(gameModule);

			if (!modPath) {
				return mithril.fatalError('Could not resolve path of module "' + gameModule + '".');
			}

			var cmdPath = modPath + '/' + commandsDirName + '/' + cmdName;

			logger.debug('Exposing command "' + gameModule + '.' + cmdName + '" at "' + cmdPath + '"');

			var mod;

			try {
				mod = require(cmdPath);
			} catch (err) {
				return mithril.fatalError('Loading user command', cmdPath, 'failed:', err);
			}

			if (!mod.params) {
				return mithril.fatalError('Command', cmdPath, 'has no configured params.');
			}

			var execPath = gameModule + cmdPathSplitter + cmdName;

			this.commands[execPath] = {
				execPath: execPath,
				mod: mod,
				requirements: requirements
			};

			count++;
		}
	}

	logger.info(count + ' commands exposed.');
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


CommandCenter.prototype.findRequirementsFailure = function (commands, tags) {
	for (var i = 0, len = commands.length; i < len; i++) {
		var cmdInfo = this.commands[commands[i].name];

		// check if the command definition exists

		if (!cmdInfo) {
			return 'Command not found or exposed: ' + commands[i].name;
		}

		var req = cmdInfo.requirements;

		// special case: no requirements

		if (!req) {
			continue;
		}

		// check if the transport protocol is allowed

		if (req.transports) {
			var transportType = tags.transportInfo ? tags.transportInfo.type : null;

			if (!transportType || req.transports.indexOf(transportType) === -1) {
				return 'Transport protocol ' + transportType + ' not allowed.';
			}
		}

		// check if all required hooks are fulfilled

		if (req.hooks) {
			if (!tags.hooks) {
				return 'Required hooks not provided.';
			}

			for (var j = 0, jlen = req.hooks.length; j < jlen; j++) {
				if (tags.hooks.indexOf(req.hooks[j]) === -1) {
					return 'Required hook not provided: ' + req.hooks[j];
				}
			}
		}
	}

	// requirement check passed
};


function processCommandHeader(state, headerData, paramsData, cb) {
	// cb: error, tags

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

				cb(error);
			} else {
				// respond with a hooks list

				cb(null, { hooks: usedHooks });
			}
		}
	);
}


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


// Command response cache implementation

// cache key: "cmdresponse"
// value:
//   format without response data:
//     queryId\n
//     JSON-options
//   or if the response data is plain-text, and thus included:
//     queryId\n
//     JSON-options\n
//     response-data-which-may-include-newlines

CommandCenter.prototype._tryLoadCachedResponse = function (session, queryId, cb) {
	// cb expects: error, options, response
	// if either options or response is falsy, it's considered a cache miss

	// graceful abort cases:
	// - if there is no session or queryId, we are unable to use cache
	// - if the TTL is set to 0, it means we don't want cache (useful for ultra stable network environments)

	logger.debug('Trying to load response cache');

	if (!queryId) {
		logger.debug('No response cache applied (queryId missing)');
		return cb();
	}

	if (!this.responseCacheTTL || this.responseCacheTTL < 1) {
		logger.debug('Response cache disabled (non-positive TTL set up)');
		return cb();
	}

	var client = getMemcachedClient();
	if (!client) {
		logger.debug('No memcached client available');
		return cb();
	}

	var keys = createResponseCacheKeys(session);
	if (!keys) {
		return cb();
	}

	// first we fetch the queryId and options object

	client.get(keys.info, function (error, info) {
		if (error) {
			logger.debug('Error while requesting response cache meta-info:', error);
			return cb();
		}

		if (typeof info !== 'string') {
			logger.debug('No response cache meta-info found:', keys.info);
			return cb();
		}

		info = info.split('\n');

		// compare the cached queryId with the given queryId

		queryId += '';
		var cachedQueryId = info[0];

		if (cachedQueryId !== queryId) {
			// a no-match here is the hot path

			logger.debug('Found a response cache, but query ID did not match:', cachedQueryId, queryId);
			return cb();
		}

		// get the response data

		client.get(keys.data, function (error, response) {
			if (error) {
				logger.error('Error while requesting response cache data:', error);
				return cb();
			}

			if (typeof response !== 'string') {
				logger.debug('Response cache was desired, but no data found:', keys.data);
				return cb();
			}

			// cache hit!
			// parse options

			var options;

			try {
				options = JSON.parse(info[1]);
			} catch (e) {
				logger.error('Error while parsing response cache options');
				return cb();
			}

			logger.debug('Loaded command response from cache.');

			cb(null, options, response);
		});
	});
};


CommandCenter.prototype._cacheResponse = function (session, queryId, options, response, cb) {
	// graceful abort cases:
	// - if there is no session or queryId, we are unable to use cache
	// - if no data to be cached has been provided
	// - if the TTL is set to < 1, it means we don't want cache (useful for ultra stable network environments)

	if (!queryId || !options || !response || !this.responseCacheTTL || this.responseCacheTTL < 1) {
		return cb();
	}

	var client = getMemcachedClient();
	if (!client) {
		return cb();
	}

	var keys = createResponseCacheKeys(session);
	if (!keys) {
		return cb();
	}

	// errors are not fatal, since cache is best effort

	// cache the response data

	var ttl = this.responseCacheTTL;

	client.set(keys.data, response, ttl, function (error) {
		if (error) {
			logger.error('Caching command response failed:', error);
			return cb();
		}

		logger.debug('Caching command response successful:', keys.data);

		// cache meta information

		var info = queryId + '\n' + JSON.stringify(options);

		client.set(keys.info, info, ttl, function (error) {
			if (error) {
				logger.error('Caching command response meta-info failed:', error);
				return cb();
			}

			logger.debug('Caching command response meta-info successful:', keys.info);

			cb();
		});
	});
};


CommandCenter.prototype._executeCommand = function (cmd, session, cb) {
	var that = this;

	var cmdInfo = this.commands[cmd.name];
	if (!cmdInfo) {
		// command not registered in this command center

		logger.error('Attempt to execute unregistered user command:', cmd);

		return cb(null, '["server"]');
	}

	// set up state

	var state = new State();

	state.setDescription(cmd.name);

	if (session) {
		state.registerSession(session);
	}

	// execute the command

	logger.debug('Executing command "' + cmdInfo.execPath + '"');

	var mod = cmdInfo.mod;
	var callParams = mod.params;

	var paramList = [state];

	for (var i = 0, len = callParams.length; i < len; i++) {
		paramList.push(cmd.params[callParams[i]]);
	}

	// add the final callback on the params list

	paramList.push(function () {
		// note: we may not expect an error parameter, the error state should now be known by the state object

		// close the state:
		// - commits and sends events to other players, or:
		// - rolls back

		state.close(function (closeError, response) {
			// use the gathered errors, response, events on the state object to build response JSON for the client
			// at this time, state.close() never returns a closeError.

			cb(null, serializeResponse(response));
		});
	});

	// call the execute function of the usercommand

	mod.execute.apply(mod, paramList);
};


CommandCenter.prototype.executeCommands = function (commandNames, headerData, paramsData, files, queryId, transportInfo, transportCb) {
	// commandNames: ['obj.sync','actor.sync']
	// headerData: [{name:'mithril.session',key:'abc'},{etc...}]
	// paramsData: [{ name: 'obj/sync', message: '{"abc":true}' }, ...]
	// queryId: if given, a number unique to this session, that identifies this request (used for caching)
	// transportInfo: { type: "http" / "https" / "websocket" / ... }

	var startTime = logger.has('time') ? Date.now() : null;

	var state = new State();

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
		logger.error('Parse error in command params data', e);

		return transportCb(null, { httpStatusCode: 400 });   // 400: Bad request
	}


	// process the header

	var that = this;

	processCommandHeader(state, headerData, paramsData, function (error, tags) {
		if (error) {
			// all errors during command header processing turn into HTTP auth errors

			state.close();

			var content;

			if (typeof error === 'object') {
				content = error.message;
			}

			return transportCb(content || '', { httpStatusCode: 401 });   // 401: Unauthorized
		}

		// there may be a session available now

		var session = state.session || null;

		// forget about the state object

		state.close();

		// stack the transportType onto the tags for compliancy checks

		tags.transportInfo = transportInfo;

		// check if requirements for all commands have been met

		var failure = that.findRequirementsFailure(commands, tags);
		if (failure) {
			logger.error('User command request requirements failed:', failure);

			return transportCb(null, { httpStatusCode: 400 });   // 400: Bad request
		}

		// try to load a previously cached response to this query

		that._tryLoadCachedResponse(session, queryId, function (error, options, response) {
			if (!error && options && response) {
				// successful cache retrieval, return instantly

				if (startTime) {
					logger.time('User command', commandNames, 'cached response took', (Date.now() - startTime), 'msec.');
				}

				return transportCb(response, options);
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

						logger.error('Unreachable error reached, in commandCenter.executeCommand callback');

						transportCb(null, { httpStatusCode: 500 });   // 500: Internal service error
					} else {
						// join every individual command response into a JSON array

						var content = '[' + results.join(',') + ']';
						var options = { mimetype: 'application/json; charset=utf-8' };

						that._cacheResponse(session, queryId, options, content, function () {
							// send the response back to the client

							if (startTime) {
								logger.time('User command', commandNames, 'execution took', (Date.now() - startTime), 'msec.');
							}

							transportCb(content, options);
						});
					}
				}
			);
		});
	});
};

