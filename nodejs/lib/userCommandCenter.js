var errors = {
	USERCOMMAND_EXPECTED: { module: 'usercommands', code: 1000, type: 'badrequest', log: { method: 'error', msg: 'User command expected.' } },
	USERCOMMAND_UNKNOWN:  { module: 'usercommands', code: 1001, type: 'badrequest', log: { method: 'error', msg: 'User command not found.' } }
};

exports.errors = errors;


var commands = {};


exports.expose = function(commandList)
{
	var count=0;

	for (var gameModule in commandList)
	{
		var cmds = commandList[gameModule];

		for (var i=0; i < cmds.length; i++)
		{
			var cmdName = cmds[i];

			if (!(gameModule in mithril))
			{
				throw ('Game module "' + gameModule + '" not found.');
			}

			if (!('userCommands' in mithril[gameModule]))
			{
				throw ('Game module "' + gameModule + '" has no userCommands listing.');
			}

			if (!(cmdName in mithril[gameModule].userCommands))
			{
				throw ('User command "' + cmdName + '" not found in module "' + gameModule + '".');
			}

			mithril.core.logger.debug('Exposing user-command "' + gameModule + '.' + cmdName + '" at "' + mithril[gameModule].userCommands[cmdName] + '"');

			commands[gameModule + '.' + cmdName] = require(mithril[gameModule].userCommands[cmdName]);
			count++;
		}
	}

	mithril.core.logger.info(count + ' user commands exposed.');
};


exports.execute = function(state, playerId, msg, cb)
{
	// check if command type is valid

	if (!('cmd' in msg) || typeof msg.cmd != 'string')
	{
		state.msgClient.error(errors.USERCOMMAND_EXPECTED);
		cb();
		return;
	}

	if (!(msg.cmd in commands))
	{
		state.msgClient.error(errors.USERCOMMAND_UNKNOWN);
		cb();
		return;
	}

	// execute the command

	commands[msg.cmd].execute(state, playerId, msg.p || {}, cb);
};

