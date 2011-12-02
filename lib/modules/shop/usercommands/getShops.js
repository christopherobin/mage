var mithril = require('../../../mithril');
var async   = require('async');

exports.params = ['types'];

exports.execute = function (state, types, cb) {
	var shops = {};

	async.forEachSeries(types, function (shopType, callback) {
		mithril.shop.getShops(state, { type: shopType, propertyOptions: { loadAll: true } }, function (error, results) {
			if (error) {
				return callback(error);
			}

			async.forEachSeries(results, function (shop, forEachCb) {
				shops[shop.identifier] = { type: shop.type, data: shop.data.getAll(state.language()) };

				mithril.shop.getItems(state, [], [shop.identifier], function (error, items) {
					if (error) {
						return forEachCb(error);
					}

					var shopItems = {};

					for (var item in items) {
						var objects = items[item].objects;
						for (var obj in objects) {
							objects[obj].data = objects[obj].data.getAll(state.language());
						}

						items[item].data = items[item].data.getAll(state.language());
						shopItems[items[item].identifier] = items[item];
					}

					shops[shop.identifier].items = shopItems;
					forEachCb();
				});

			}, function (error) {
				if (error) {
					return callback(error);
				}

				callback();
			});


		});
	},
	function (error) {
		if (error) {
			return cb(error);
		}

		state.respond(shops);
		cb(null, shops);
	});
};
