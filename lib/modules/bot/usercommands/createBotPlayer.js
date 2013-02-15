/*
 * UserCommand: /bot/bot.createBotPlayer
 *
 * Usage:
 *      curl --url http://<HOST>/bot/bot.createBotPlayer \
 *          -H "Host: <EXPOSED DOMAIN NAME>" \
 *          -d $'[{"name":"bot.psk","key":"<PSK>"}]\n{"options":{<ADDITIONAL OPTIONS>}}'
 */

var mage = require('../../../mage');

exports.params = ['options'];

exports.execute = function (state, options, cb) {
	// Ensure options is an object
	options = options || {};

	// Now run the registered command
	mage.bot.run(state, 'createBotPlayer', { options: options }, cb);
};