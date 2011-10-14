var mithril = require('../../../mithril');
var crypto  = require('crypto');
var config = mithril.getConfig('tool');

exports.execute = function (state, params, cb) {
	var propMap = new mithril.core.PropertyMap();

	if (params && params.rights) {
		propMap.add('rights', params.rights);
	}

	if (params.password) {
		var sql = 'UPDATE gm SET password = ? WHERE actor = ?';
		var pass = crypto.createHmac('sha1', config.hashkey).update(params.password).digest('hex');
		var args = [pass, params.actor];

		state.datasources.db.exec(sql, args, null, function (error) {
			if (error) {
				return cb(error);
			}

			mithril.gm.setProperties(state, params.actor, propMap, function (error) {
				if (error) { return cb(error); }
				cb();
			});
		});
	} else {
		mithril.gm.setProperties(state, params.actor, propMap, function (error) {
			if (error) { return cb(error); }
			cb();
		});
	}
};
