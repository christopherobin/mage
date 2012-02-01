var mithril = require('./mithril'),
    async = require('async'),
    State = require('./state').State;


var commandsDirName = 'usercommands';
var cmdPathSplitter = '.';	// what separates the module name and command name
var commandResponseTTL = 3 * 60;	// cache lifetime of the command response


// message hooks

var messageHooks = {};

exports.registerMessageHook = function (type, fn) {
	messageHooks[type] = fn;
};


// CommandCenter implementation

function CommandCenter(appName) {
	this.appName = appName;
	this.commands = {};
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

				mithril.core.logger.error('Trying to expose command "' + gameModule + cmdPathSplitter + cmdName + '" twice on "' + this.appName + '" command center. Ignoring.');
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

			mithril.core.logger.debug('Exposing command "' + gameModule + '.' + cmdName + '" at "' + cmdPath + '"');

			var mod = require(cmdPath);

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

	mithril.core.logger.info(count + ' commands exposed.');
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

			for (var i = 0, len = req.hooks.length; i < len; i++) {
				if (tags.hooks.indexOf(req.hooks[i]) === -1) {
					return 'Required hook not provided: ' + req.hooks[i];
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
		return state.error(null, 'Error parsing header: ' + headerData, cb);
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

/*
function processCommandHeader(state, memo, header, message, cb) {
	// allow any hooks to play with the message

	var usedHooks = [];

	async.reduce(
		header,
		message,
		function (prevMessage, entry, callback) {
			var hookType = entry.name;

			if (!hookType) {
				return callback();
			}

			var hook = messageHooks[hookType];

			if (!hook) {
				return state.error(null, 'Unknown hook type: ' + hookType, callback);
			}

			usedHooks.push(hookType);

			hook(state, memo, entry, prevMessage, callback);
		},
		function (error, finalMessage) {
			if (error) {
				// parse error, or other error, so we cannot respond

				cb(error);
			} else {
				// decode the message

				if (finalMessage.length === 0) {
					finalMessage = null;
				} else {
					try {
						finalMessage = JSON.parse(finalMessage);
					} catch (e) {
						state.error(null, 'Parse error in user command.', cb);
						return;
					}
				}

				// move on, in order to execute the command

				var tags = {};

				if (usedHooks.length > 0) {
					tags.hooks = usedHooks;
				}

				cb(null, tags, finalMessage);
			}
		}
	);
}
*/

function serializeResponse(response) {
	if (response.sysErrorCode) {
		return '[' + JSON.stringify(response.sysErrorCode) + ']';
	}

	if (response.userErrorCode) {
		return '[null,' + JSON.stringify(response.userErrorCode) + ']';
	}

	var out = '[null,null,' + (response.response || 'null');

	if (response.myEvents) {
		out += ',[' + response.myEvents.join(',') + ']';
	}

	out += ']';

	return out;
}


CommandCenter.prototype._executeCommand = function (cmd, session, cb) {
	var that = this;

	var cmdInfo = this.commands[cmd.name];
	if (!cmdInfo) {
		// command not registered in this command center

		return cb(null, '["server"]');
	}

	// set up state

	var state = new State();

	if (session) {
		state.registerSession(session);
	}

	// execute the command

	mithril.core.logger.debug('Executing command "' + cmdInfo.execPath + '"');

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

			if (closeError) {
				// TODO: is this error a failure to commit?
			}

			cb(null, serializeResponse(response));
		});
	});

	// call the execute function of the usercommand

	mod.execute.apply(mod, paramList);
};

function tryLoadCachedResponse(session, queryId, cb) {
	// cb expects: error, options, response
	// if either options or response is falsy, it's considered a cache miss

	// if there is no session or queryId, we can bail out immediately (session is required for cache)

	if (!session || !queryId) {
		return cb();
	}

	// TODO: implement cache lookup

	cb();
}


function cacheResponse(session, queryId, options, response, cb) {
	// if there is no session or queryId, we can bail out immediately (session is required for cache)

	if (!session || !queryId || !options || !response) {
		return cb();
	}

	// TODO: save to cache

	cb();
}


CommandCenter.prototype.executeCommands = function (commandNames, headerData, paramsData, queryId, transportInfo, transportCb) {
	// commandNames: ['obj.sync','actor.sync']
	// headerData: [{name:'mithril.session',key:'abc'},{etc...}]
	// paramsData: [{ name: 'obj/sync', message: '{"abc":true}' }, ...]
	// queryId: if given, a number unique to this session, that identifies this request (used for caching)
	// transportInfo: { type: "http" / "https" / "websocket" / ... }

	var that = this;
	var state = new State();

	// parse the parameter data

	var commandCount = commandNames.length;
	var commands = new Array(commandCount);

	try {
		var paramsLines = paramsData.split('\n');

		for (var i = 0; i < commandCount; i++) {
			commands[i] = {
				name: commandNames[i],
				params: paramsLines[i] ? JSON.parse(paramsLines[i]) : {}
			};
		}
	} catch (e) {
		return transportCb(null, { httpStatusCode: 400 });   // 400: Bad request
	}


	// process the header

	processCommandHeader(state, headerData, paramsData, function (error, tags) {
		if (error) {
			// TODO: perhaps an HTTP auth error makes the most sense here

			state.close(function (closeError, response) {
				cb(null, serializeResponse(response));
			});
			return;
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
			mithril.core.logger.error('User command request requirements failed:', failure);

			return transportCb(null, { httpStatusCode: 400 });   // 400: Bad request
		}

		// try to load a previously cached response to this query

		tryLoadCachedResponse(session, queryId, function (error, options, response) {
			if (!error && options && response) {
				// successful cache retrieval, return instantly

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

						transportCb(null, { httpStatusCode: 500 });   // 500: Internal service error
					} else {
						// join every individual command response into a JSON array

						var content = '[' + results.join(',') + ']';
						var options = { mimetype: 'application/json; charset=utf-8' };

						// TODO: gzip if it makes sense (add that info to options)

						cacheResponse(session, queryId, options, content, function () {
							// send the response back to the client

							transportCb(content, options);
						});
					}
				}
			);
		});
	});
};

