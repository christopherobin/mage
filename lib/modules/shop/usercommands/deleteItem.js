var mithril = require('../../../mithril');

exports.params = ['shopIdentifier', 'itemIdentifier'];

exports.execute = function (state, shopIdentifier, itemIdentifier, cb) {
	mithril.shop.delItem(state, shopIdentifier, itemIdentifier, function (errors) {
		if (errors) {
			return cb(errors);
		}

		cb();
	});
};
