var mithril = require('../../../mithril');

exports.params = ['id'];

exports.execute = function (state, id, cb) {
	mithril.shop.delItemObject(state, id, function (errors) {
		if (errors) {
			return cb(errors);
		}

		cb();
	});
};
