var mithril = require('./mithril'),
    path = require('path');


var userCommandsDirName = 'usercommands';
var commands = {};


exports.expose = function (requirements, commandList) {
	var count = 0;

	for (var gameModule in commandList) {
		var cmds = commandList[gameModule];

		for (var i = 0, len = cmds.length; i < len; i++) {
			var cmdName = cmds[i];

			if (!mithril[gameModule]) {
				return mithril.fatalError('Game module "' + gameModule + '" not found.');
			}

			var modPath = mithril.getModulePath(gameModule);

			if (!modPath) {
				return mithril.fatalError('Could not resolve path of module "' + gameModule + '".');
			}

			var cmdPath = modPath + '/' + userCommandsDirName + '/' + cmdName;

			mithril.core.logger.debug('Exposing user-command "' + gameModule + '.' + cmdName + '" at "' + cmdPath + '"');

			commands[gameModule + '.' + cmdName] = {
				fn: require(cmdPath).execute,
				requirements: requirements
			};

			count++;
		}
	}

	mithril.core.logger.info(count + ' user commands exposed.');
};


exports.execute = function (state, tags, cmdName, p, cb) {
	// check if command type is valid

	if (!cmdName || typeof cmdName !== 'string') {
		return state.error(null, 'User command expected.', cb);
	}

	var cmd = commands[cmdName];

	if (!cmd) {
		return state.error(null, 'User command "' + cmdName + '" unknown.', cb);
	}


	// check requirements on this user command

	var requirements = cmd.requirements;

	if (requirements) {
		// check if the transport protocol is allowed

		if (requirements.transports) {
			if (!tags.transport || requirements.transports.indexOf(tags.transport) === -1) {
				return state.error(null, 'Transport protocol ' + tags.transport + ' not allowed for command "' + cmdName + '".', cb);
			}
		}

		// check if all required hooks are fulfilled

		if (requirements.hooks) {
			if (!tags.hooks) {
				return state.error(null, 'Required hooks not provided for command "' + cmdName + '".', cb);
			}

			for (var i = 0, len = requirements.hooks.length; i < len; i++) {
				if (tags.hooks.indexOf(requirements.hooks[i]) === -1) {
					return state.error(null, 'Required hooks not provided for command "' + cmdName + '".', cb);
				}
			}
		}
	}


	// execute the command

	mithril.core.logger.debug('Executing command "' + cmdName + '"');

	cmd.fn(state, p || {}, cb);
};

