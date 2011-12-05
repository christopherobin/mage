var mithril = require('../../../mithril');
var crypto  = require('crypto');
var config = mithril.core.config.get('tool');

exports.params = ['actor', 'password', 'rights'];

exports.execute = function (state, actor, password, rights, cb) {
	var propMap = new mithril.core.PropertyMap();

	if (rights) {
		propMap.add('rights', rights);
	}

	if (password) {
		var sql = 'UPDATE gm SET password = ? WHERE actor = ?';
		var pass = crypto.createHmac('sha1', config.hashkey).update(password).digest('hex');
		var args = [pass, actor];

		state.datasources.db.exec(sql, args, null, function (error) {
			if (error) {
				return cb(error);
			}

			mithril.gm.setProperties(state, actor, propMap, function (error) {
				if (error) {
					return cb(error);
				}

				cb();
			});
		});
	} else {
		mithril.gm.setProperties(state, actor, propMap, function (error) {
			if (error) {
				return cb(error);
			}

			cb();
		});
	}
};
