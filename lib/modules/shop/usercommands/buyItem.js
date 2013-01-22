var mage = require('../../../mage');


exports.params = ['itemId', 'shopName', 'quantity'];


exports.execute = function (state, itemId, shopName, quantity, cb) {
	var items = {};

	items[itemId] = quantity;

	mage.shop.startPurchase(state, state.actorId, shopName, items, function (error, response) {
		if (!error) {
			state.respond(response);
		}

		cb();
	});
};
