var mithril = require('../../../mithril');

exports.execute = function (state, params, cb) {
	mithril.shop.addItem(state, params, function (errors, itemIdent) {
		if (errors) {
			return cb(errors);
		}

		state.respond(itemIdent);
		cb();
	});
};
