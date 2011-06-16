exports.execute = function(state, p, cb) {

	mithril.shop.getItems(state, null, function(error, items) {
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

