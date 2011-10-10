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


exports.execute = function (state, cmd, p, cb) {
	// check if command type is valid

	if (!cmd || typeof cmd !== 'string') {
		return state.error(null, 'User command expected.', cb);
	}

	if (!(cmd in commands)) {
		return state.error(null, 'User command unknown.', cb);
	}

	// check if there is a valid session

	if (!state.session) {
		return state.error(null, 'Not allowed to execute user command with a valid session.', cb);
	}

	// execute the command

	mithril.core.logger.debug('Executing command "' + cmd + '"');

	commands[cmd].execute(state, p || {}, cb);
};

