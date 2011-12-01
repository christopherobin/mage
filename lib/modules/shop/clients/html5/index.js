(function () {

	var mithril = window.mithril;
	var mod = mithril.registerModule($html5client('module.shop.construct'));

	var shopsIdMap = {};
	var shopsIdentMap = {};
	var itemsIdMap = {};
	var itemsIdentMap = {};

	mod.setup = function (cb) {
		mod.sync(function (errors, response) {
			if (errors) {
				return cb(errors);
			}
			if ('shops' in response) {
				for (var i = 0, len = response.shops.length; i < len; i++) {
					shop = response.shops[i];
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
			cb();
		});
	};


	// TODO: the response to shop.buyItem may contain a property called "redirect" which is a URL, this needs to become an event which we can listen for
/*
	mod.buyItem = function (itemId, shopName, quantity, cb) {
		mithril.io.send('shop.buyItem', { itemId: itemId, quantity: quantity, shopName: shopName }, function (errors, response) {
			if (errors) {
				return cb(errors);
			}

			if (cb) {
				cb(null, response);
			}

			if (response.redirect) {
				window.location.href = response.redirect;
			}
		});
	};
*/

	mod.getShopByIdentifier = function (identifier) {
		return shopsIdentMap[identifier] || null;
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
