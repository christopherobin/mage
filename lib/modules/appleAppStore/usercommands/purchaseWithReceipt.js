var mithril = require('../../../mithril');


exports.params = ['receipt'];


exports.execute = function (state, receipt, cb) {
	mithril.appleAppStore.purchaseWithReceipt(state, state.actorId, receipt, function (error, response) {
		if (!error) {
			state.respond(response);
		}

		cb();
	});
};

