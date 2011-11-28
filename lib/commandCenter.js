var mithril = require('./mithril'),
	async = require('async');


var commandsDirName = 'usercommands';


function CommandCenter(appName) {
	this.appName = appName;
	this.commands = {};
}


var splitter = '/';	// what separates the module name and command name


CommandCenter.prototype.expose = function (requirements, commandList) {
	var count = 0;

	for (var gameModule in commandList) {
		var cmds = commandList[gameModule];

		for (var i = 0, len = cmds.length; i < len; i++) {
			var cmdName = cmds[i];

			var cmd = this.commands[gameModule + splitter + cmdName];
			if (cmd) {
				// user command was already exposed, so we augment the requirements list with an alternative requirement

				mithril.core.logger.error('Trying to expose command "' + gameModule + splitter + cmdName + '" twice on "' + this.appName + '" command center. Ignoring.');
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

			this.commands[gameModule + splitter + cmdName] = {
				mod: require(cmdPath),
				requirements: requirements
			};

			count++;
		}
	}

	mithril.core.logger.info(count + ' commands exposed.');
};


exports.CommandCenter = CommandCenter;


function checkRequirements(state, tags, requirements, cb) {
	// check if the transport protocol is allowed

	if (requirements.transports) {
		if (!tags.transport || requirements.transports.indexOf(tags.transport) === -1) {
			return cb(null, 'Transport protocol ' + tags.transport + ' not allowed.');
		}
	}

	// check if all required hooks are fulfilled

	if (requirements.hooks) {
		if (!tags.hooks) {
			return cb(null, 'Required hooks not provided.');
		}

		for (var i = 0, len = requirements.hooks.length; i < len; i++) {
			if (tags.hooks.indexOf(requirements.hooks[i]) === -1) {
				return cb(null, 'Required hook not provided: ' + requirements.hooks[i]);
			}
		}
	}

	// requirement check passed

	cb();
}


var commandResponseTTL = 3 * 60;


CommandCenter.prototype.execute = function (state, tags, cmdName, queryId, p, cb) {
	// check if command type is valid

	var cmd = this.commands[cmdName];

	if (!cmd) {
		return state.error(null, 'User command "' + cmdName + '" unknown.', cb);
	}


	// check if there is a cached command response for this query

	state.tryLoadCachedResponse(queryId, function (error, loaded) {
		if (error) {
			return cb(error);
		}

		if (loaded) {
			// cached response found! our work here is done

			return cb();
		}

		// no cached response, let's try to execute this command

		// check requirements on this user command

		checkRequirements(state, tags, cmd.requirements, function (error, failure) {
			if (error) {
				return cb(error);
			}

			if (failure) {
				mithril.core.logger.debug('Auth failed:', failure);

				state.userError('auth', cb);
			} else {
				if (!p) {
					p = {};
				}

				// execute the command

				mithril.core.logger.debug('Executing command "' + cmdName + '"');

				cmd.mod.execute(state, p, cb);
			}
		});
	});
};

