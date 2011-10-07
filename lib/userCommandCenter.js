var mithril = require('./mithril'),
    path = require('path');


var userCommandsDirName = 'usercommands';
var commands = {};


exports.expose = function (commandList) {
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

			commands[gameModule + '.' + cmdName] = require(cmdPath);

			count++;
		}
	}

	mithril.core.logger.info(count + ' user commands exposed.');
};


exports.execute = function (state, cb) {
	// check if command type is valid

	if (!state.cmd || typeof state.cmd !== 'string') {
		return state.error(null, 'User command expected.', cb);
	}

	if (!(state.cmd in commands)) {
		return state.error(null, 'User command unknown.', cb);
	}

	// execute the command

	mithril.core.logger.debug('Executing command "' + state.cmd + '"');

	commands[state.cmd].execute(state, state.p, cb);
};

