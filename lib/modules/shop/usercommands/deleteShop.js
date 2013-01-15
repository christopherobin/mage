var mage = require('../../../mage');

exports.params = ['identifier'];

exports.execute = function (state, identifier, cb) {
	mage.shop.delShop(state, identifier, function (errors) {
		if (errors) {
			return cb(errors);
		}

		cb();
	});
};
