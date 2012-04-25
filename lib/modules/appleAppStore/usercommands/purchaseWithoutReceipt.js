var mithril = require('../../../mithril');


exports.params = ['forActorId', 'appleProductId', 'quantity'];


exports.execute = function (state, forActorId, appleProductId, quantity, cb) {
	mithril.appleAppStore.purchaseWithoutReceipt(state, forActorId, appleProductId, quantity, function (error, response) {
		if (!error) {
			state.respond(response);
		}

		cb();
	});
};

