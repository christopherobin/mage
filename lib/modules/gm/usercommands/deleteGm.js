var mithril = require('../../../mithril');

exports.params = ['id'];

exports.execute = function (state, id, cb) {
	var sql = 'DELETE FROM gm WHERE actor = ?';
	state.datasources.db.exec(sql, [id], null, function (error) {
		if (error) {
			return cb(error);
		}
		cb();
	});
};
