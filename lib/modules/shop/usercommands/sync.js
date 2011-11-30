var mithril = require('../../../mithril');


exports.params = [];


exports.execute = function (state, cb) {

	var shopNames = mithril.core.config.get('module.shop.sync.shopNames');

	if (!shopNames) {
		return cb();
	}

	var response = {};

	mithril.shop.getShops(state, null, function (err, shops) {

		response.shops = shops;

		mithril.shop.getItems(state, null, shopNames, function (error, items) {
			if (!error) {
				for (var id in items) {
					// if item is not visible, throw it out

					var item = items[id];

					if (item.status !== 'visible') {
						delete items[id];
					} else {
						item.data = item.data.getAll(state.language());
					}

					for (var i = 0, len = item.objects.length; i < len; i++) {
						var o = item.objects[i];

						if (o.data) {
							o.data = o.data.getAll(state.language());
						}
					}
				}
				response.items = items;
			}
			state.respond(response);
			cb();
		});
	});
};

