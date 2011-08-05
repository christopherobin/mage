var mithril = require('./mithril');


var commands = {};


exports.expose = function(commandList)
{
	var count=0;

	for (var gameModule in commandList)
	{
		var cmds = commandList[gameModule];

		for (var i=0, len = cmds.length; i < len; i++)
		{
			var cmdName = cmds[i];

			if (!mithril[gameModule])
			{
				mithril.core.logger.error('Game module "' + gameModule + '" not found.');
				return false;
			}

			if (!mithril[gameModule].userCommands)
			{
				mithril.core.logger.error('Game module "' + gameModule + '" has no userCommands listing.');
				return false;
			}

			if (!mithril[gameModule].userCommands[cmdName])
			{
				mithril.core.logger.error('User command "' + cmdName + '" not found in module "' + gameModule + '".');
				return false;
			}

			mithril.core.logger.debug('Exposing user-command "' + gameModule + '.' + cmdName + '" at "' + mithril[gameModule].userCommands[cmdName] + '"');

			commands[gameModule + '.' + cmdName] = require(mithril[gameModule].userCommands[cmdName]);

			count++;
		}
	}

	mithril.core.logger.info(count + ' user commands exposed.');
	return true;
};


exports.execute = function(state, cb)
{
	// check if command type is valid

	if (!state.cmd || typeof state.cmd !== 'string')
	{
		return state.error(null, 'User command expected.', cb);
	}

	if (!(state.cmd in commands))
	{
		return state.error(null, 'User command unknown.', cb);
	}

	// execute the command

	mithril.core.logger.debug('Executing command "' + state.cmd + '"');

	commands[state.cmd].execute(state, state.p, cb);
};

