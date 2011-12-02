var mithril = require('../../../mithril');

exports.params = ['itemIdentifier', 'unitPrice', 'data'];

exports.execute = function (state, itemIdentifier, unitPrice, data, cb) {
	mithril.shop.editItem(state, itemIdentifier, unitPrice, data, function (errors) {
		if (errors) {
			return cb(errors);
		}

		cb();
	});
};
