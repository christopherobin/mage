var mithril = require('../../../mithril.js');


exports.execute = function(state, p, cb) {

	var cfg = mithril.core.config.module.shop;

	var shopNames = (cfg && cfg.sync) ? (cfg.sync.shopNames || null) : null;

	mithril.shop.getItems(state, null, shopNames, function(error, items) {
		if (!error)
		{
			for (var itemId in items)
			{
				//if item is not visible, throw it out
				var item = items[itemId];

				if(item.status != 'visible')
				{
					delete items[itemId];
				}
				else
				{
					item.data = item.data.getAll(state.language());
				}
			}
			console.log(items)
			state.respond(items);
		}

		cb();
	});
};

