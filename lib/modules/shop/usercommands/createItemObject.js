var mithril = require('../../../mithril');

exports.params = ['itemId', 'className', 'quantity', 'tags', 'data'];

exports.execute = function (state, itemId, className, quantity, tags, data, cb) {
	mithril.shop.addItemObject(state, itemId, className, quantity, tags, data, function (errors, id) {
		if (errors) {
			return cb(errors);
		}

		state.respond(id);
		cb();
	});
};
