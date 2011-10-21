function MithrilGameModShopGm(mithril) {
	this.mithril = mithril;
}


MithrilGameModShopGm.prototype.getShops = function (params, cb) {
	this.mithril.io.send('shop.getShops', params, cb);
}

MithrilGameModShopGm.prototype.createShop = function (params, cb) {
	this.mithril.io.send('shop.createShop', params, cb);
}

MithrilGameModShopGm.prototype.editShop = function (params, cb) {
	this.mithril.io.send('shop.editShop', params, cb);
}

MithrilGameModShopGm.prototype.deleteShop = function (params, cb) {
	this.mithril.io.send('shop.deleteShop', params, cb);
}

MithrilGameModShopGm.prototype.createItem = function (params, cb) {
	this.mithril.io.send('shop.createItem', params, cb);
}

MithrilGameModShopGm.prototype.editItem = function (params, cb) {
	this.mithril.io.send('shop.editItem', params, cb);
}

MithrilGameModShopGm.prototype.deleteItem = function (params, cb) {
	this.mithril.io.send('shop.deleteItem', params, cb);
}

MithrilGameModShopGm.prototype.createItemObject = function (params, cb) {
	this.mithril.io.send('shop.createItemObject', params, cb);
}

MithrilGameModShopGm.prototype.editItemObject = function (params, cb) {
	this.mithril.io.send('shop.editItemObject', params, cb);
}

MithrilGameModShopGm.prototype.deleteItemObject = function (params, cb) {
	this.mithril.io.send('shop.deleteItemObject', params, cb);
}

MithrilGameModShopGm.prototype.deleteItemObjects = function (params, cb) {
	this.mithril.io.send('shop.deleteItemObjects', params, cb);
}
