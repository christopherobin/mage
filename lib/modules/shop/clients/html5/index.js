(function () {

	var mage = window.mage;
	var mod = mage.registerModule($html5client('module.shop.construct'));

	var shopsIdMap = {};
	var shopsIdentMap = {};
	var itemsIdMap = {};
	var itemsIdentMap = {};


	mod.setup = function (cb) {
		mod.sync(function (error, response) {
			if (error) {
				return cb(error);
			}

			if (response) {
				if ('shops' in response) {
					for (var i = 0, len = response.shops.length; i < len; i++) {
						var shop = response.shops[i];
						shopsIdMap[shop.id] = shop;
						shopsIdentMap[shop.identifier] = shop;
					}
				}

				if ('items' in response) {
					for (var key in response.items) {
						var item = response.items[key];

						itemsIdMap[key] = item;
						itemsIdentMap[item.identifier] = item;
					}
				}
			}

			cb();
		});
	};


	mod.getShopByIdentifier = function (identifier) {
		return shopsIdentMap[identifier] || null;
	};


	mod.getShopsByType = function (type) {
		var results = [];
		for (var id in shopsIdMap) {
			var shop = shopsIdMap[id];
			if (shop.type === type) {
				results.push(shop);
			}
		}

		return results;
	};


	mod.getItemByIdentifier = function (ident) {
		return itemsIdentMap[ident] || null;
	};


	mod.getItemsById = function (itemIds) {
		var results = [];
		for (var id in itemsIdMap) {
			var item = itemsIdMap[id];
			if (itemIds.indexOf(item.id) !== -1) {
				results.push(item);
			}
		}

		return results;
	};

}());
