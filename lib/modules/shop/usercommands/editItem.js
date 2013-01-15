var mage = require('../../../mage');

exports.params = ['itemId', 'unitPrice', 'data'];

exports.execute = function (state, itemId, unitPrice, data, cb) {
	mage.shop.editItem(state, itemId, unitPrice, data, function (errors) {
		if (errors) {
			return cb(errors);
		}

		cb();
	});
};
