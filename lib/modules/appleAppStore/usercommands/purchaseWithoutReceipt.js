var mage = require('../../../mage');


exports.params = ['forActorId', 'appleProductId', 'quantity'];


exports.execute = function (state, forActorId, appleProductId, quantity, cb) {
	mage.appleAppStore.purchaseWithoutReceipt(state, forActorId, appleProductId, quantity, function (error, response) {
		if (!error) {
			state.respond(response);
		}

		cb();
	});
};

