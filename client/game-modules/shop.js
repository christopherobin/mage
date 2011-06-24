function MithrilGameModShop(mithril)
{
	this.mithril = mithril;
	this.shops = {};
}


MithrilGameModShop.prototype.setup = function(cb)
{
	var _this = this;

	this.mithril.io.send('shop.sync', {}, function(errors, items) {
		if (errors) return cb(errors);

		if(items)
		{
			for (var key in items)
			{
				shopName = (items[key].shopName) ? items[key].shopName : "defaultShop";
				
				if(!_this.shops[shopName]) { _this.shops[shopName] = {}; _this.shops[shopName].items = []; } //setup 
				_this.shops[shopName].items.push(items[key]);
			}
		}
		cb();
	});
};


MithrilGameModShop.prototype.buyItem = function(itemId, shopName, quantity, cb)
{
	var _this = this;

	this.mithril.io.send('shop.buyItem', { itemId: itemId, quantity: quantity, shopName: shopName }, function(errors, response) {
		if (errors) return cb(errors);

		if (response.redirect)
		{
			window.location.href = response.redirect;
		}

		cb();
	});
};

