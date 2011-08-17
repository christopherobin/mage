var mithril = require('../../../mithril');


exports.execute = function (state, p, cb) {

	var shopNames = mithril.getConfig('module.shop.sync.shopNames');

	if (!shopNames) {
		return cb();
	}

	mithril.shop.getItems(state, null, shopNames, function (error, items) {
		if (!error) {
			for (var itemId in items) {
				// if item is not visible, throw it out

				var item = items[itemId];

				if (item.status !== 'visible') {
					delete items[itemId];
				} else {
					item.data = item.data.getAll(state.language());
				}
			}

			state.respond(items);
		}

		cb();
	});
};

