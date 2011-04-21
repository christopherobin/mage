var errors = {
	USERCOMMAND_EXPECTED: { module: 'usercommands', code: 1000, type: 'badrequest', log: { method: 'error', msg: 'User command expected.' } },
	USERCOMMAND_UNKNOWN:  { module: 'usercommands', code: 1001, type: 'badrequest', log: { method: 'error', msg: 'User command not found.' } }
};

exports.errors = errors;


var commands = {};


exports.register = function(commandList)
{
	var i=0;

	for (var cmdName in commandList)
	{
		commands[cmdName] = commandList[cmdName];
		i++;
	}

	mithril.core.logger.info(i + ' user commands registered.');
};


exports.execute = function(state, playerId, msg)
{
	// check if command type is valid

	if (!('cmd' in msg) || typeof msg.cmd != 'string')
	{
		mithril.core.warn(errors.USERCOMMAND_EXPECTED, state.msgClient);
		return;
	}

	if (!(msg.cmd in commands))
	{
		mithril.core.warn(errors.USERCOMMAND_UNKNOWN, state.msgClient);
		return;
	}

	// execute the command

	commands[msg.cmd].execute(state, playerId, msg);
};

