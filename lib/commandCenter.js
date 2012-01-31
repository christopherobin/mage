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


function checkRequirements(state, tags, requirements, cb) {
	// check if the transport protocol is allowed

	if (requirements.transports) {
		if (!tags.transportInfo || requirements.transports.indexOf(tags.transportInfo.type) === -1) {
			return cb('Transport protocol ' + tags.transportInfo.type + ' not allowed.');
		}
	}

	// check if all required hooks are fulfilled

	if (requirements.hooks) {
		if (!tags.hooks) {
			return cb('Required hooks not provided.');
		}

		for (var i = 0, len = requirements.hooks.length; i < len; i++) {
			if (tags.hooks.indexOf(requirements.hooks[i]) === -1) {
				return cb('Required hook not provided: ' + requirements.hooks[i]);
			}
		}
	}

	// requirement check passed

	cb();
}


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


CommandCenter.prototype._executeCommand = function (cmd, memo, transportInfo, cb) {
	var that = this;

	var cmdInfo = this.commands[cmd.name];
	if (!cmdInfo) {
		// command not registered in this command center

		return cb(null, '["server"]');
	}

	var state = new State();

	// parse the header and pull out the command parameters

	processCommandHeader(state, memo, cmd.header, cmd.message, function (error, tags, params) {
		if (error) {
			state.close(function (closeError, response) {
				cb(null, serializeResponse(response));
			});
			return;
		}

		// stack the transportType onto the tags for compliancy check

		tags.transportInfo = transportInfo;

		// check if all requirements of this user command have been met

		checkRequirements(state, tags, cmdInfo.requirements, function (failure) {
			if (failure) {
				state.error(null, 'Command requirements not met: ' + failure);

				state.close(function (closeError, response) {
					cb(null, serializeResponse(response));
				});
				return;
			}

			// execute the command

			mithril.core.logger.debug('Executing command "' + cmdInfo.execPath + '"');

			if (!params) {
				params = {};
			}

			var mod = cmdInfo.mod;
			var callParams = mod.params;

			var paramList = [state];

			for (var i = 0, len = callParams.length; i < len; i++) {
				paramList.push(params[callParams[i]]);
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

			mod.execute.apply(mod, paramList);
		});
	});
};


CommandCenter.prototype.executeCommands = function (commands, cacheOptions, transportInfo, transportCb) {
	// commands: [{ name: 'obj/sync', header: '[]', message: '{"abc":true}' }, ...]
	// cacheOptions: { sessionKey: string, queryId: number, requestHash: str }
	// transportType: "http" / "https" / "websocket" / ...

	if (cacheOptions && cacheOptions.requestHash) {
		// load sessionKey/queryId cache
		// compare requestHash
		// if it matches, return the previously generated result, else continue
	}

	// set up a value map, for message hooks to store information on, so subsequent command execution does not cause
	// useless session lookups etc...

	var memo = {};
	var that = this;

	// start executing commands

	async.mapSeries(
		commands,
		function (cmd, callback) {
			that._executeCommand(cmd, memo, transportInfo, callback);	// callback receives a serialized response string
		},
		function (error, results) {
			if (error) {
				// should never happen, since no error is fatal

				transportCb(null, { httpStatusCode: 500 });   // 500: Internal service error
			} else {
				// join every individual command response into a JSON array

				var content = '[' + results.join(',') + ']';
				var options = { mimetype: 'application/json; charset=utf-8' };

				// TODO: if cacheOptions and memo.session detected, cache the response

				transportCb(content, options);
			}
		}
	);
};

