/*
 * UserCommand: /bot/bot.updateBotPlayer
 *
 * Usage:
 *      curl --url http://<HOST>/bot/bot.updateBotPlayer \
 *          -H "Host: <EXPOSED DOMAIN NAME>" \
 *          -d $'[{"mage.session":{"key":"<SESSION KEY>"}}]\n{"options":{<ADDITIONAL OPTIONS>}}'
 */

var mage = require('../../../mage');

exports.access = 'user';

exports.params = ['options'];

exports.execute = function (state, options, cb) {
	var actorId = state.actorId;

	if (!state.session.meta.isBot) {
		return state.error(null, 'Session is not a bot-session', cb);
	}

	mage.bot.run(state, 'updateBotPlayer', { actorId: actorId, options: options || {} }, cb);
};
