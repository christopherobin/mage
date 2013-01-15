var mage = require('../../../mage');


exports.params = [];


exports.execute = function (state, cb) {

	var shopNames = mage.core.config.get('module.shop.sync.shopNames');

	if (!shopNames) {
		return cb();
	}

	var response = {};

	mage.shop.getShops(state, null, function (err, shops) {

		response.shops = [];

		for (var i = 0, len = shops.length; i < len; i++) {
			var inShop = shops[i];
			var outShop = {};
			for (var key in inShop) {
				if (key === 'data') {
					outShop.data = inShop.data.getAllFlat(state.language(), null, null);
				} else {
					outShop[key] = inShop[key];
				}
			}
			response.shops.push(outShop);
		}

		mage.shop.getItems(state, null, shopNames, function (error, items) {

			response.items = {};

			for (var id in items) {
				var inItem = items[id];
				var outItem = {};
				if (inItem.status === 'visible') {
					for (var key in inItem) {
						if (key === 'data') {
							outItem.data = inItem.data.getAll(state.language(), null, null);
						} else if (key !== 'objects') {
							outItem[key] = inItem[key];
						}
					}
					response.items[id] = outItem;
				}

			}
			state.respond(response);
			cb();
		});
	});
};

