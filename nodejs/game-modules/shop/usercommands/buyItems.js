exports.execute = function(state, p, cb) {

	mithril.shop.startPurchase(state, state.actorId, p.items, function(error, response) {
		if (!error)
			state.respond(response);

		cb();
	});
};

