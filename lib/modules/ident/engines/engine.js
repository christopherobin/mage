/**
 * Your engine will receive it's config and a contextualized logger.
 * @constructor
 */
function Engine(/*cfg, logger*/) {
	// nothing
}

/**
 * The auth method of your engine. that one should always be implemented. It is also responsible for
 * registering the session. This function function is called by the "mage.ident.check" function on
 * the client.
 *
 * @param {State}    state       The state object
 * @param {Object}   credentials Parameters that are meaningful for your engine come from here
 * @param {Function} cb
 */
Engine.prototype.auth = function (state, credentials, cb) {
	cb(new Error('Auth function not implemented'));
};

/**
 * Sometimes engine may need to allow users to run commands on them, for example for creating users,
 * running multiple steps before doing the actual auth, etc... This is where you should implement
 * this. Rights management can be done using the "state.canAccess" method.
 *
 * @param {State}    state   The state object
 * @param {string}   command The command to run on the engine
 * @param {Object}   params  Parameters for that command
 * @param {Function} cb      A callback that take an error and potential data that will be sent to
 *                           the client.
 */
Engine.prototype.run = function (state, command, params, cb) {
	cb(new Error('Run function not implemented'));
};

exports.Engine = Engine;