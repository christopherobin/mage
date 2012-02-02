var mithril = require('../../../mithril');


exports.params = ['username', 'password'];


exports.execute = function (state, username, password, cb) {
	var sql = 'SELECT actor, password FROM gm WHERE username = ?';
	state.datasources.db.getOne(sql, [username], false, null, function (error, gm) {
		if (error) {
			return cb(error);
		}

		if (!gm) {
			return state.userError('invalidLogin', cb);
		}

		if (mithril.gm.checkPassword(password, gm.password)) {
			mithril.session.register(state, gm.actor, function (error, session) {
				if (error) {
					mithril.core.logger.error(error);
					return cb(error);
				} else {
					state.respond(session.getFullKey());
					return cb();
				}
			});
		} else {
			return state.userError('invalidLogin', cb);
		}
	});
};

