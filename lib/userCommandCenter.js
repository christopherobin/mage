var mithril = require('./mithril'),
    path = require('path'),
	async = require('async');


var userCommandsDirName = 'usercommands';
var commands = {};


exports.expose = function (requirements, commandList) {
	var count = 0;

	for (var gameModule in commandList) {
		var cmds = commandList[gameModule];

		for (var i = 0, len = cmds.length; i < len; i++) {
			var cmdName = cmds[i];

			var cmd = commands[gameModule + '.' + cmdName];
			if (cmd) {
				// user command was already exposed, so we augment the requirements list with an alternative requirement

				if (requirements) {
					cmd.requirements = cmd.requirements.concat(requirements); 
				}

				continue;
			}


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
				requirements: [].concat(requirements)
			};

			count++;
		}
	}

	mithril.core.logger.info(count + ' user commands exposed.');
};


function checkRequirement(state, cmdName, tags, requirement, cb) {
	// check if the transport protocol is allowed

	if (requirement.transports) {
		if (!tags.transport || requirement.transports.indexOf(tags.transport) === -1) {
			return cb(null, 'Transport protocol ' + tags.transport + ' not allowed for command "' + cmdName + '".');
		}
	}

	// check if all required hooks are fulfilled

	if (requirement.hooks) {
		if (!tags.hooks) {
			return cb(null, 'Required hooks not provided for command "' + cmdName + '".');
		}

		for (var i = 0, len = requirement.hooks.length; i < len; i++) {
			if (tags.hooks.indexOf(requirement.hooks[i]) === -1) {
				return cb(null, 'Required hooks not provided for command "' + cmdName + '".');
			}
		}
	}

	// requirement check passed

	cb();
}


function checkRequirements(state, cmdName, tags, requirements, cb) {
	var len = requirements.length;

	if (len === 0) {
		return cb();
	}

	if (len === 1) {
		// requirements is a single requirement

		return checkRequirement(state, cmdName, tags, requirements[0], cb);
	}

	// there is a list of requirements, any of which may be valid

	var lastFailure;

	async.forEachSeries(
		requirements,
		function (requirement, callback) {
			checkRequirement(state, cmdName, tags, requirement, function (error, failure) {
				if (error) {
					return cb(error);
				}

				if (failure) {
					// test failed, next test
					lastFailure = failure;
					callback();
				} else {
					// test passed, continue
					cb();
				}
			});
		},
		function (error) {
			if (error) {
				cb(error);
			} else {
				// our lastFailure has become our error, since it was fatal

				mithril.core.logger.debug(lastFailure);

				cb(lastFailure);
			}
		}
	);
}


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

	checkRequirements(state, cmdName, tags, cmd.requirements, function (error) {
		if (error) {
			cb(error);
		} else {
			// execute the command

			mithril.core.logger.debug('Executing command "' + cmdName + '"');

			cmd.fn(state, p || {}, cb);
		}
	});
};

