var mithril = require('../../../mithril');

exports.execute = function (state, params, cb) {
	var sql = 'DELETE FROM gm WHERE actor = ?';
	state.datasources.db.exec(sql, [params.id], null, function (error) {
		if (error) {
			return cb(error);
		}
		cb();
	});
};
