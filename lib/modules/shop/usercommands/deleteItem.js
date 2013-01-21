var mage = require('../../../mage');

exports.params = ['shopIdentifier', 'itemIdentifier'];

exports.execute = function (state, shopIdentifier, itemIdentifier, cb) {
	mage.shop.delItem(state, shopIdentifier, itemIdentifier, function (errors) {
		if (errors) {
			return cb(errors);
		}

		cb();
	});
};
