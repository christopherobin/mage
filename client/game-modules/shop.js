function MithrilGameModShop(mithril)
{
	this.mithril = mithril;
	this.items = null;
}


MithrilGameModShop.prototype.setup = function(cb)
{
	var _this = this;

	this.getAllItems(function(errors, items) {
		if (errors) return cb(errors);

		_this.items = items;

		cb();
	});
};


MithrilGameModShop.prototype.getAllItems = function(cb)
{
	var _this = this;

	this.mithril.io.send('shop.getAllItems', {}, function(errors, items) {
		if (errors) return cb(errors);

		cb(null, items);
	});
};


MithrilGameModShop.prototype.buyItem = function(itemId, quantity, cb)
{
	var _this = this;

	this.mithril.io.send('shop.buyItem', { itemId: itemId, quantity: quantity }, function(errors, response) {
		if (errors) return cb(errors);

		if (response.redirect)
		{
			window.location.href = response.redirect;
		}

		cb();
	});
};

