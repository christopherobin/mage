var mithril = require('../../../mithril');

exports.execute = function (state, params, cb) {
	mithril.shop.delItemObject(state, params, function (errors) {
		if (errors) {
			return cb(errors);
		}

		cb();
	});
};
