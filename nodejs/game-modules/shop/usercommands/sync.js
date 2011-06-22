exports.execute = function(state, p, cb) {

	var cfg = mithril.core.config.game.shop;

	var shopNames = (cfg && cfg.sync) ? (cfg.sync.shopNames || null) : null;
	
	
	mithril.shop.getItems(state, null, shopNames, function(error, items) {
		if (!error)
		{
			for (var itemId in items)
			{
				var item = items[itemId];
				item.data = item.data.getAll(state.language());
			}

			state.respond(items);
		}

		cb();
	});
};

