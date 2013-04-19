/*
 * UserCommand: /bot/bot.startBotSession
 *
 * Usage:
 *      curl --url http://<HOST>/bot/bot.pskStartBotSession \
 *          -H "Host: <EXPOSED DOMAIN NAME>" \
 *          -d $'[]\n{"psk":"<PRE-SHARED KEY>","actorId":"<ACTOR ID>","options":{<ADDITIONAL OPTIONS>}}'
 */

var mage = require('../../../mage');

exports.access = 'anonymous';  // secure by PSK

exports.params = ['psk', 'actorId', 'options'];

exports.execute = function (state, psk, actorId, options, cb) {
	// yields an actorId in the response

	mage.bot.checkPsk(state, psk, function (error) {
		if (error) {
			return cb(error);
		}

		mage.bot.run(state, 'confirmBotPlayer', { actorId: actorId }, function (error) {
			if (error) {
				return cb(error);
			}

			mage.bot.run(state, 'startBotSession', { actorId: actorId, options: options || {} }, cb);
		});
	});
};
