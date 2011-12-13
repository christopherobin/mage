var mithril = require('../../../mithril');

exports.params = ['username', 'password', 'rights'];

exports.execute = function (state, username, password, rights, cb) {
	mithril.gm.addGm(state, username, password, rights, function (error, gm) {
		if (error) {
			cb(false);
			mithril.core.logger.error(error);
		} else {
			state.respond(gm);
			cb(200);
		}
	});
};

