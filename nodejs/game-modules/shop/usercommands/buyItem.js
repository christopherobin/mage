exports.execute = function(state, p, cb) {

	var items = {};
	items[p.itemId] = p.quantity;

	mithril.shop.startPurchase(state, state.actorId, items, function(error, response) {
		if (!error)
			state.respond(response);

		cb();
	});
};

