var mithril = require('../../../mithril');


exports.params = ['itemId', 'shopName', 'quantity'];


exports.execute = function (state, itemId, shopName, quantity, cb) {
	var items = {};

	items[itemId] = quantity;

	mithril.shop.startPurchase(state, state.actorId, shopName, items, function (error, response) {
		if (!error) {
			state.respond(response);
		}

		cb();
	});
};
