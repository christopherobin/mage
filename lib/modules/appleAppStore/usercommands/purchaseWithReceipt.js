var mage = require('../../../mage');


exports.params = ['receipt'];


exports.execute = function (state, receipt, cb) {
	mage.appleAppStore.purchaseWithReceipt(state, state.actorId, receipt, function (error, response) {
		if (!error) {
			state.respond(response);
		}

		cb();
	});
};

