var mithril = require('../../../mithril');

exports.params = ['identifier'];

exports.execute = function (state, identifier, cb) {
	mithril.shop.delShop(state, identifier, function (errors) {
		if (errors) {
			return cb(errors);
		}

		cb();
	});
};
