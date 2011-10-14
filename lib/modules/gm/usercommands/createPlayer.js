var mithril = require('../../../mithril');


exports.execute = function (state, params, cb) {
	mithril.game.addGamePlayer(state, params.name || 'test', params.language || 'EN', function (error, actor) {
		if (error) {
			cb(false);
			mithril.core.logger.error(error);
		} else {
			state.respond(actor);
			cb(200, 'actor:' + actor);
		}
	});
};

