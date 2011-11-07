(function () {

	var mithril = window.mithril;

	var mod = {};

	mithril.registerModule('gm', mod);


	mod.login = function (fields, cb) {
		mithril.io.send('gm.login', fields, null, cb);
	};

	mod.getGms = function (cb) {
		mithril.io.send('gm.getGms', {}, null, cb);
	};

	mod.createGm = function (params, cb) {
		mithril.io.send('gm.createGm', params, null, cb);
	};

	mod.editGm = function (params, cb) {
		mithril.io.send('gm.editGm', params, null, cb);
	};

	mod.deleteGm = function (params, cb) {
		mithril.io.send('gm.deleteGm', params, null, cb);
	};


	mod.setup = function (cb) {
		// player module extensions

		mithril.player.gm = {};

		mithril.player.gm.getPlayers = function (cb) {
			mithril.io.send('player.getPlayers', {}, null, cb);
		};

		mithril.player.gm.editPlayer = function (params, cb) {
			mithril.io.send('player.editPlayer', params, null, cb);
		};

		mithril.player.gm.deletePlayer = function (params, cb) {
			mithril.io.send('player.deletePlayer', params, null, cb);
		};

		mithril.player.gm.getPlayerData = function (params, cb) {
			mithril.io.send('player.getPlayerData', params, null, cb);
		};



		// shop module extensions

		mithril.shop.gm = {};

		mithril.shop.gm.getShops = function (params, cb) {
			mithril.io.send('shop.getShops', params, null, cb);
		};

		mithril.shop.gm.createShop = function (params, cb) {
			mithril.io.send('shop.createShop', params, null, cb);
		};

		mithril.shop.gm.editShop = function (params, cb) {
			mithril.io.send('shop.editShop', params, null, cb);
		};

		mithril.shop.gm.deleteShop = function (params, cb) {
			mithril.io.send('shop.deleteShop', params, null, cb);
		};

		mithril.shop.gm.createItem = function (params, cb) {
			mithril.io.send('shop.createItem', params, null, cb);
		};

		mithril.shop.gm.editItem = function (params, cb) {
			mithril.io.send('shop.editItem', params, null, cb);
		};

		mithril.shop.gm.deleteItem = function (params, cb) {
			mithril.io.send('shop.deleteItem', params, null, cb);
		};

		mithril.shop.gm.createItemObject = function (params, cb) {
			mithril.io.send('shop.createItemObject', params, null, cb);
		};

		mithril.shop.gm.editItemObject = function (params, cb) {
			mithril.io.send('shop.editItemObject', params, null, cb);
		};

		mithril.shop.gm.deleteItemObject = function (params, cb) {
			mithril.io.send('shop.deleteItemObject', params, null, cb);
		};

		mithril.shop.gm.deleteItemObjects = function (params, cb) {
			mithril.io.send('shop.deleteItemObjects', params, null, cb);
		};

		cb();
	};
}());
