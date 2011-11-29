var mithril = require('../../../mithril');


exports.params = ['receipt'];


exports.execute = function (state, p, cb) {
	mithril.appleAppStore.purchaseWithReceipt(state, state.actorId, p.receipt, function (error, response) {
		if (!error) {
			state.respond(response);
		}

		cb();
	});
};

