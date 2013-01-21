var mage = require('../../../mage');


exports.params = ['items', 'shopName'];


exports.execute = function (state, items, shopName, cb) {
	mage.shop.startPurchase(state, state.actorId, shopName, items, function (error, response) {
		if (!error) {
			state.respond(response);
		}

		cb();
	});
};

