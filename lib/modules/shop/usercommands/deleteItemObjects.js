var mithril = require('../../../mithril');

exports.params = ['ids'];

exports.execute = function (state, ids, cb) {
	mithril.shop.delItemObjects(state, ids, function (errors) {
		if (errors) {
			return cb(errors);
		}

		cb();
	});
};
