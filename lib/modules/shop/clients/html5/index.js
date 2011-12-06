(function () {

	var mithril = window.mithril;

	var mod = mithril.registerModule($html5client('module.shop.construct'));


	var shops = {};


	mod.setup = function (cb) {
		mod.sync(function (errors, items) {
			if (errors) {
				return cb(errors);
			}

			if (items) {
				for (var key in items) {
					var item = items[key];

					var shop = shops[item.shopIdentifier];

					if (shop) {
						shop.items.push(item);
					} else {
						shops[item.shopIdentifier] = { items: [item] };
					}
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
		return shops[identifier] || null;
	};


	mod.getItemByIdentifier = function (ident, shopIdentifier) {
		var shop = shops[shopIdentifier];

		if (shop) {
			var items = shop.items;
			if (items) {
				for (var i = 0, len = items.length; i < len; i++) {
					if (items[i].identifier === ident) {
						return items[i];
					}
				}
			}
		}

		return null;
	};

}());
