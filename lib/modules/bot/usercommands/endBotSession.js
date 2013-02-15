/*
 * UserCommand: /bot/bot.endBotSession
 *
 * Usage:
 *      curl --url http://<HOST>/bot/bot.endBotSession \
 *          -H "Host: <EXPOSED DOMAIN NAME>" \
 *          -d $'[{"name":"bot.psk","key":"<PSK>"}]\n{"actorId":"<ACTOR ID>","options":{<ADDITIONAL OPTIONS>}}'
 */

var mage = require('../../../mage');

exports.params = ['actorId', 'options'];

exports.execute = function (state, actorId, options, cb) {
	// First things first, verify if the provided actorId is a bot player
	mage.bot.run(state, 'confirmBotPlayer', { actorId: actorId }, function (error) {
		// Return on error
		if (error) {
			return cb(error);
		}

		// Ensure options is an object
		options = options || {};

		// Now run the registered command
		mage.bot.run(state, 'endBotSession', { actorId: actorId, options: options }, cb);
	});
};