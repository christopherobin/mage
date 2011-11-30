var mithril = require('../../../mithril');


exports.execute = function (state, params, cb) {
	mithril.gm.addGm(state, params, function (error, gm) {
		if (error) {
			cb(false);
			mithril.core.logger.error(error);
		} else {
			state.respond(gm);
			cb(200);
		}
	});
};

