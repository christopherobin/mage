var mithril = require('../../../mithril');

exports.execute = function (state, params, cb) {
	mithril.shop.addItemObject(state, params, function (errors, id) {
		if (errors) { return cb(errors); }

		state.respond(id);
		cb();
	});
};
