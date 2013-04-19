/*
 * This module enables 3rd parties to create automated game clients (bots). To
 * use this module game developers need to register the functions listed below
 * well as run the initialization function mage.bot.createAPI(cb). See
 * mage/lib/modules/bot/usercommands/<USER COMMAND>.js for argument requirements.
 *
 *
 * Required functions:
 *   createBotPlayer: Creates a new player and return their actorId to the client,
 *                    this should also include the handling of additional options
 *                    such as name, noTutorial and powerPlayer. As well as a way
 *                    to identify this player as a bot.
 *
 *   updateBotPlayer: The refreshing of any resource properties your players may
 *                    have to undergo gameplay. Such as mana, energy, stamina etc.
 *
 *  confirmBotPlayer: A check which can determine whether a player is a bot player
 *                    or not. This should use the identifier setup during player
 *                    creation. It should throw an error on failure.
 *
 *
 * Additional overloadable functions:
 *   startBotSession: Creates and returns a new session for a player.
 *
 *     endBotSession: Terminates a session for a provided player.
 *
 *
 * 3rd party applications can then connect to the API via RESTFUL HTTP requests
 * as shown below.
 *
 *
 * Curl Usage: curl --url <URL PATH> -H 'Host: <VHOST>' -d $'[{"name":"bot.psk","key":<PSK>}]\n{<ARGUMENTS>}'
 *
 *     URL PATH: The full URI in the format of http://<HOST>/bot/<USER COMMAND>
 *
 *        VHOST: The fully qualified domain name on which the game is exposed, i.e. game.host.com
 *
 *          PSK: The pre-shared key configured inside the config
 *
 *    ARGUMENTS: The arguments required for user command, i.e. {"options":{"noTutorial":true}}
 *
 *
 * Example Usage:
 *      curl --url http://server.host.com/bot/bot.pskCreateBotPlayer \
 *          -H "Host: game.host.com" \
 *          -d $'[{"name":"bot.psk","key":"12345"}]\n{"options":{"powerPlayer":true,"noTutorial":true}}'
 */

var mage = require('../../mage');

var commands = {};


/**
 * Checks if the given PSK is valid. If not, registers the error on the state object.
 *
 * @param state {State}     A State instance
 * @param psk   {string}    The pre-shared key to check
 * @param cb    {Function}  Callback (receives no arguments but error)
 */
exports.checkPsk = function (state, psk, cb) {
	// Get bot module configs

	var config = mage.core.config.get('module.bot');

	if (!config || !config.psk) {
		return state.error(null, 'Bot module pre-shared key not configured', cb);
	}

	if (config.psk !== psk) {
		return state.error('auth', 'Invalid pre-shared key', cb);
	}

	return cb();
};


/**
 * Function which allows end-user to register (and overwrite) command handlers
 *
 * @param   {string}    commandName     User command name, must be the same as usercommand filename
 * @param   {Function}  cb              Function to call upon return
 */
exports.register = function (commandName, cb) {
	commands[commandName] = cb;
};


/**
 * Function which is used by user commands to execute registered command handlers
 *
 * @param   {Object}    state           Current request state object
 * @param   {string}    commandName     User command name, must be the same as usercommand filename
 * @param   {Object}    args            Arguments to pass to command upon execution
 * @param   {Function}  cb              Function to call upon return
 */
exports.run = function (state, commandName, args, cb) {
	var fn = commands[commandName];
	if (!fn) {
		return state.error(null, 'No command implementation registered for bot-command: ' + commandName, cb);
	}

	fn(state, args, function (error, response) {
		if (error) {
			return cb(error);
		}

		if (response !== undefined) {
			state.respond(response);
		}

		cb();
	});
};


/**
 * Adds the PhantomJS loader page to the given app
 *
 * @param app {WebApp}
 */

exports.createPhantomJsLoader = function (app) {
	app.addIndexPage('phantom', __dirname + '/botPages/phantomLoader', { route: 'phantom' });
};


/**
 * Register startBotSession function for startBotSession usercommand. This is a global
 * registration which will be available to all applications.
 *
 * Required args:
 *          actorId: The actorId for whom you wish to acquire a new session
 *
 * Options:
 *   dropOldSession: Whether or not an existing session should dropped and replaced
 *
 * Note: built-in command handlers, may be overwritten by the end-user by calling bot.register()
 */

exports.register('startBotSession', function (state, args, callback) {
	var playerState = new mage.core.State();

	function cb() {
		var args = arguments;

		playerState.close(function () {
			callback.apply(null, args);
		});
	}

	mage.session.activeSessionExists(state, args.actorId, function (error, sessionExists) {
		if (error) {
			return cb(error);
		}

		if (sessionExists && !args.options.dropOldSession) {
			return state.error(null, 'Actor already has a session.', cb);
		}

		mage.session.register(playerState, args.actorId, 'en', { isBot: true, access: 'user' }, function (error, session) {
			if (error) {
				return state.error(null, 'Could not register session', cb);
			}

			cb(null, session.getFullKey());
		});
	});
});


/**
 * Register endBotSession function for endBotSession usercommand. This is a global
 * registration which will be available to all applications.
 *
 * Note: built-in command handlers, may be overwritten by the end-user by calling bot.register()
 */

exports.register('endBotSession', function (state, args, cb) {
	state.session.expire(state);
	cb();
});