/*
 * This module enables 3rd parties to created automated game clients (bots). To
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
 * Additional overloadable funcitons:
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
 *      curl --url http://server.host.com/bot/bot.createBotPlayer \
 *          -H "Host: game.host.com" \
 *          -d $'[{"name":"bot.psk","key":"12345"}]\n{"options":{"powerPlayer":true,"noTutorial":true}}'
 */

var mage = require('../../mage');


var config;
var commands = {};
var testPages = [];


/**
 * Register the message hook bot.psk which will check if the API caller provided
 * the correct pre shared key.
 */
mage.core.cmd.registerMessageHook('bot.psk', function (state, params, messageData, cb) {
	// Make sure the pre shared key is inside the configuration
	if (!config || config.psk === '') {
		return state.error('config', 'Bot module pre-shared key not configured', cb);
	}

	// If pre shared keys don't match, return an auth error
	if (config.psk && config.psk !== params.key) {
		return state.error('auth', 'Invalid pre-shared key', cb);
	}

	// Otherwise return success
	cb();
});


/**
 * Function which allows end-user to register (and overwrite) command handlers
 *
 * @param   {String}    commandName     User command name, must be the same as usercommand filename
 * @param   {Function}  cb              Function to call upon return
 */
exports.register = function (commandName, cb) {
	commands[commandName] = cb;
};


/**
 * Function which is used by user commands to execute registered command handlers
 *
 * @param   {Object}    state           Current request state object
 * @param   {String}    commandName     User command name, must be the same as usercommand filename
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
 * Add frontend test page to testPages array object, this will be exposed during
 * createAPI phase.
 *
 * @param {String}      name        Name of bot loader
 * @param {String}      path        Path to bot loader
 * @param {Object}      options     Options to pass to addIndexPage
 */
exports.addBotPage = function (name, path, options) {
	testPages.push({ name: name, path: path, options: options });
};


/**
 * Expose API under /app/bot if configured in the config file
 *
 * @param   {Function}      cb      Callback to call upon return
 */
exports.createAPI = function (cb) {
	// Get bot module configs
	config = mage.core.config.get('module.bot');

	// This will automatically stop setting up on no entry in config???
	var botApp = new mage.core.app.web.WebApp('bot', { languages: ['EN'] });

	// Expose user commands with psk auth hook
	// NOTE: Firewall authentication is done via config.app.bot.firewall,
	// this is disabled by default.
	botApp.commandCenter.expose(
		{ hooks: ['bot.psk'] },
		{
			bot: ['createBotPlayer', 'updateBotPlayer', 'startBotSession', 'endBotSession']
		}
	);

	// Expose PhantomJS Loader
	botApp.addIndexPage('phantom', __dirname + '/botPages/phantomLoader', {route: 'phantom'});

	// Expose test pages
	for (var page in testPages) {
		// Set default route to be the name of the page
		var options = testPages[page].options || {};
		if (!options.route && !options.routes) {
			options.route = testPages[page].name;
		}

		botApp.addIndexPage(testPages[page].name, testPages[page].path, options);
	}

	cb(null, botApp);
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
 * Note: built-in command handlers, may be overwritten by the end-user by
 * calling bot.register()
 */
exports.register('startBotSession', function (state, args, cb) {
	// Start fresh state object
	var playerState = new mage.core.State();

	// Check if actor already has a session
	mage.session.activeSessionExists(state, args.actorId, function (error, exists) {
		// Return on error
		if (error) {
			return cb(error);
		}

		// Return error if actorId already has a session and dropOldSession is not true
		if (exists && !args.options.dropOldSession) {
			return state.error(null, 'Actor already has a session key.', cb);
		}

		// Otherwise register a new session
		mage.session.register(playerState, args.actorId, 'en', ['isBot'], function (error, session) {
			// Close state and commit changes
			playerState.close();

			// Return on errors
			if (error) {
				return cb(error);
			}

			// Otherwise successful
			cb(null, session.getFullKey());
		});
	});
});


/**
 * Register endBotSession function for endBotSession usercommand. This is a global
 * registration which will be available to all applications.
 *
 * Note: built-in command handlers, may be overwritten by the end-user by calling bot.register()
 *
 * Required args:
 *     actorId: The actorId for whose session you wish to terminate
 *
 */
exports.register('endBotSession', function (state, args, cb) {
	// Get actors session
	mage.session.getActorSession(state, args.actorId, function (error, session) {
		// Return on error
		if (error) {
			return cb(error);
		}

		// Return error if actorId does not have a session
		if (!session) {
			return state.error(null, 'Actor does not have a session key.', cb);
		}

		// Otherwise expire actors session
		session.expire(state);
	});
});