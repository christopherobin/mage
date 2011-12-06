var mithril = require('../../../mithril');

exports.params = ['itemIdentifier', 'className', 'quantity', 'tags', 'data'];

exports.execute = function (state, itemIdentifier, className, quantity, tags, data, cb) {
	mithril.shop.addItemObject(state, itemIdentifier, className, quantity, tags, data, function (errors, id) {
		if (errors) {
			return cb(errors);
		}

		state.respond(id);
		cb();
	});
};
