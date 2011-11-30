var mithril = require('../../../mithril');


exports.params = ['items', 'shopName'];


exports.execute = function (state, items, shopName, cb) {
	mithril.shop.startPurchase(state, state.actorId, shopName, items, function (error, response) {
		if (!error) {
			state.respond(response);
		}

		cb();
	});
};

