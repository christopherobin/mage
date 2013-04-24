/*
 * UserCommand: /bot/bot.createBotPlayer
 *
 * Usage:
 *      curl --url http://<HOST>/bot/bot.pskCreateBotPlayer \
 *          -H "Host: <EXPOSED DOMAIN NAME>" \
 *          -d $'[]\n{"psk":"<PRE-SHARED KEY>","options":{<ADDITIONAL OPTIONS>}}'
 */

var mage = require('../../../mage');

exports.access = 'anonymous';  // secure by PSK

exports.params = ['psk', 'options'];

exports.execute = function (state, psk, options, cb) {
	// yields an actorId in the response

	mage.bot.checkPsk(state, psk, function (error) {
		if (error) {
			return cb(error);
		}

		mage.bot.run(state, 'createBotPlayer', { options: options || {} }, cb);
	});
};
