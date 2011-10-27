var mithril = require('../../../mithril');

exports.execute = function (state, params, cb) {
	var sql = 'SELECT actor, password FROM gm WHERE username = ?';
	state.datasources.db.getOne(sql, [params.username], true, null, function (error, gm) {
		if (error) {
			return cb(error);
		}

		if (mithril.gm.checkPassword(params.password, gm.password)) {
			var response = {};
			mithril.player.sessions.register(state, gm.actor, function (error, session) {
				if (error) {
					cb(false);
					mithril.core.logger.error(error);
				} else {
					response.session = session.key;
					response.id = gm.actor;
					response.status = 'success';
					state.respond(response);
					cb(null, response);
				}
			});

/*			//do I need this?
			mithril.gm.getProperties(state, gm.actor, null, function (error, data) {
				if (error) {
					return cb(error);
				}

				gm.data = data;

				state.respond({ status: 'success', id: gm.actor });
				cb(null, gm);
			});
*/
		} else {
			state.userError('invalidLogin', cb);
		}
	});
};

