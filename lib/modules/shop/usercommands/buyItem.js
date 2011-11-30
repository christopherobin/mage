var mithril = require('../../../mithril');


exports.params = ['itemId', 'shopName', 'quantity'];


exports.execute = function (state, p, cb) {
	var items = {};

	items[p.itemId] = p.quantity;

	mithril.shop.startPurchase(state, state.actorId, p.shopName, items, function (error, response) {
		if (!error) {
			state.respond(response);
		}

		cb();
	});
};
