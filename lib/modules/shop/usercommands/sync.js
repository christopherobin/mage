var mithril = require('../../../mithril');


exports.params = [];


exports.execute = function (state, cb) {

	var shopNames = mithril.core.config.get('module.shop.sync.shopNames');

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
/*
				for (var i = 0, len = item.objects.length; i < len; i++) {
					var o = item.objects[i];

					if (o.data) {
						o.data = o.data.getAll(state.language());
					}
				}
*/
			}

			state.respond(items);
		}

		cb();
	});
};

