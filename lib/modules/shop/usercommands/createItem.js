var mage = require('../../../mage');

exports.params = ['identifier', 'prefix', 'currencyType', 'unitPrice', 'shopIdentifier', 'data'];

exports.execute = function (state, identifier, prefix, currencyType, unitPrice, shopIdentifier, data, cb) {
	mage.shop.addItem(state, identifier, prefix, currencyType, unitPrice, shopIdentifier, data, function (errors, itemIdent) {
		if (errors) {
			return cb(errors);
		}

		state.respond(itemIdent);
		cb();
	});
};
