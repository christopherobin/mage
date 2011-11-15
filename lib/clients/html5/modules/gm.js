(function () {

	var mithril = window.mithril;

	var mod = {};

	mithril.registerModule('gm', mod);



	mod.login = function (fields, cb) {
		mithril.io.send('gm.login', fields, cb);
	};

	mod.getGms = function (cb) {
		mithril.io.send('gm.getGms', {}, cb);
	};

	mod.createGm = function (params, cb) {
		mithril.io.send('gm.createGm', params, cb);
	};

	mod.editGm = function (params, cb) {
		mithril.io.send('gm.editGm', params, cb);
	};

	mod.deleteGm = function (params, cb) {
		mithril.io.send('gm.deleteGm', params, cb);
	};


	mod.setup = function (cb) {
		// player module extensions

		mithril.player.gm = {};

		mithril.player.gm.getPlayers = function (cb) {
			mithril.io.send('player.getPlayers', {}, cb);
		};

		mithril.player.gm.editPlayer = function (params, cb) {
			mithril.io.send('player.editPlayer', params, cb);
		};

		mithril.player.gm.deletePlayer = function (params, cb) {
			mithril.io.send('player.deletePlayer', params, cb);
		};

		mithril.player.gm.getPlayerData = function (params, cb) {
			mithril.io.send('player.getPlayerData', params, cb);
		};



		// shop module extensions

		mithril.shop.gm = {};

		mithril.shop.gm.getShops = function (params, cb) {
			mithril.io.send('shop.getShops', params, cb);
		};

		mithril.shop.gm.createShop = function (params, cb) {
			mithril.io.send('shop.createShop', params, cb);
		};

		mithril.shop.gm.editShop = function (params, cb) {
			mithril.io.send('shop.editShop', params, cb);
		};

		mithril.shop.gm.deleteShop = function (params, cb) {
			mithril.io.send('shop.deleteShop', params, cb);
		};

		mithril.shop.gm.createItem = function (params, cb) {
			mithril.io.send('shop.createItem', params, cb);
		};

		mithril.shop.gm.editItem = function (params, cb) {
			mithril.io.send('shop.editItem', params, cb);
		};

		mithril.shop.gm.deleteItem = function (params, cb) {
			mithril.io.send('shop.deleteItem', params, cb);
		};

		mithril.shop.gm.createItemObject = function (params, cb) {
			mithril.io.send('shop.createItemObject', params, cb);
		};

		mithril.shop.gm.createItemObjects = function (params, cb) {
			mithril.io.send('shop.createItemObjects', params, cb);
		};

		mithril.shop.gm.editItemObject = function (params, cb) {
			mithril.io.send('shop.editItemObject', params, cb);
		};

		mithril.shop.gm.deleteItemObject = function (params, cb) {
			mithril.io.send('shop.deleteItemObject', params, cb);
		};

		mithril.shop.gm.deleteItemObjects = function (params, cb) {
			mithril.io.send('shop.deleteItemObjects', params, cb);
		};


		// gc module setup

		mithril.gc.gm = {};

		mithril.gc.gm.sync = function (cb) {
			mithril.io.send('gc.gmsync', {}, function (error, response) {
				if (error) {
					return cb(error);
				}

				cacheArr = response;
				cacheMap = {};

				for (var i = 0, len = response.length; i < len; i++) {
					var node = response[i];

					cacheMap[node.id] = node;
				}

				mithril.gc.replaceCache(cacheMap, cacheArr);

				cb();
			});
		};
		
		mithril.gc.gm.addNodes = function (nodes, cb) {
			mithril.io.send('gc.addNodes', nodes, cb);
		};

		mithril.gc.gm.editNodes = function (nodes, cb) {
			mithril.io.send('gc.editNodes', nodes, cb);
		};

		mithril.gc.gm.delNodes = function (nodes, cb) {
			mithril.io.send('gc.delNodes', nodes, cb);
		};

		// End of gm
		cb();
	};
}());
