exports.userCommands = {
	sync:      __dirname + '/usercommands/sync.js',
	buyItem:   __dirname + '/usercommands/buyItem.js',
	buyItems : __dirname + '/usercommands/buyItems.js'
};


exports.hooks = {
	getGenericPurchaseMessage: function() { return ''; },
	validateItemChoice:        {}
};


var knownCurrencyMap = {};

// knownCurrencyMap: { identifier: { id: 123, callbacks: { validate: fn, start: fn } } }
// 	only oncomplete is required as a callback, all the others are optional


function registerCurrency(identifier, id, callbacks)
{
	if (!callbacks.validate) return false;
	if (!callbacks.start) return false;

	knownCurrencyMap[identifier] = { id: id, callbacks: callbacks };

	return true;
};


exports.enforceCurrency = function(state, identifier, callbacks, cb)
{
	// returns the ID of the given currency identifier.
	// if the identifier does not exist, it will be created and its ID will be returned.

	var sql = 'INSERT IGNORE INTO shop_currency (identifier) VALUES(?)';
	var params = [identifier];

	state.datasources.db.exec(sql, params, null, function(error, info) {
		if (error) return cb(error);

		if (info.insertId)
		{
			if (!registerCurrency(identifier, info.insertId, callbacks))
			{
				return state.error(null, 'Failed to register currency: ' + identifier, cb);
			}

			return cb();
		}

		exports.getCurrencyId(state, identifier, function(error, id) {
			if (!registerCurrency(identifier, id, callbacks))
			{
				return state.error(null, 'Failed to register currency: ' + identifier, cb);
			}

			cb();
		});
	});
};


exports.getCurrencyId = function(state, identifier, cb)
{
	var query = 'SELECT id FROM shop_currency WHERE identifier = ?';
	var params = [identifier];

	state.datasources.db.getOne(query, params, true, null, function(error, row) {
		if (error) return cb(error);

		cb(null, row.id);
	});
};


exports.getItems = function(state, itemIds, shopNames, cb)
{
	// if no itemIds given, all items will be returned, if no shopName given, all will return

	var query = 'SELECT i.id, i.shopId, s.name AS shopName, i.identifier, i.status, i.currencyId, i.unitPrice, c.identifier AS currencyIdentifier FROM shop_currency AS c JOIN shop_item AS i ON i.currencyId = c.id JOIN shop AS s ON s.id = i.shopId';
	var params = [];
	var where = [];

	if (shopNames && shopNames.length > 0)
	{
		where.push('s.name IN (' + shopNames.map(function() { return '?'; }).join(', ') + ')');
		params = params.concat(shopNames);
	}

	if (itemIds && itemIds.length > 0)
	{
		where.push('i.id IN (' + itemIds.map(function() { return '?'; }).join(', ') + ')');
		params = params.concat(itemIds);
	}

	if (where.length > 0)
	{
		query += ' WHERE ' + where.join(' AND ');
	}

	state.datasources.db.getMany(query, params.concat([]), null, function(error, rows) {
		if (error) return cb(error);

		itemIds = rows.map(function(row) { return row.id; });

		// make item objects

		var result = {};
		var len = rows.length;

		for (var i=0; i < len; i++)
		{
			var row = rows[i];

			row.data = new mithril.core.PropertyMap;
			row.objects = [];

			result[row.id] = row;
		}

		// for each item, get data
		var query = 'SELECT itemId, property, language, type, value FROM shop_item_data WHERE itemId IN (' + itemIds.map(function() { return '?'; }).join(', ') + ')';
		var params = itemIds;

		state.datasources.db.getMany(query, params.concat([]), null, function(error, rows) {
			if (error) return cb(error);

			var len = rows.length;
			for (var i=0; i < len; i++)
			{
				var row = rows[i];

				result[row.itemId].data.importOne(row.property, row.type, row.value, row.language);
			}

			// for each item, get object instantiation info
			query = 'SELECT itemId, className, quantity, tags FROM shop_item_object WHERE itemId IN (' + itemIds.map(function() { return '?'; }).join(', ') + ')';

			state.datasources.db.getMany(query, params.concat([]), null, function(error, rows) {
				if (error) return cb(error);

				var len = rows.length;

				for (var i=0; i < len; i++)
				{
					var row = rows[i];

					var itemId = row.itemId;
					delete row.itemId;

					result[itemId].objects.push(row);
				}

				cb(null, result);
			});
		});
	});
};


exports.startPurchase = function(state, forActorId, shopName, items, cb)
{
	// this method starts a purchase process
	// it is required that all requested items share the same currency

	// items: { itemId: qty, itemId, qty, ... }

	if (!forActorId || forActorId == state.actorId) forActorId = null;

	var validator = exports.hooks.validateItemChoice[shopName];

	if (!validator)
	{
		validator = function(state, shopName, items, cb) {
			var itemIds = [];
			for (var itemId in items)
			{
				itemIds.push(~~itemId);
			}
			exports.getItems(state, itemIds, [shopName], function(err,data){

				for (var itemId in data)
				{
					data[itemId].quantity = Math.max(~~items[itemId], 1);
				}
				cb(null,data)
			});
		};
	}

	validator(state, shopName, items, function(error, itemInfo) {
		if (error) return cb(error);

		if (!itemInfo)
		{
			return cb(null, { failed: 'badchoice' });
		}

		var itemIds = [];

		for (var itemId in itemInfo)
		{
			itemIds.push(~~itemId);
		}

		// check total cost

		var totalPrice = 0;
		var currencies = [];

		for (var itemId in itemInfo)
		{
			var item = itemInfo[itemId];
			totalPrice += ~~item.unitPrice * ~~item.quantity;

			if (currencies.indexOf(item.currencyIdentifier) == -1)
			{
				currencies.push(item.currencyIdentifier);
			}
		}

		// check the currency that is being used

		if (currencies.length != 1 || !knownCurrencyMap[currencies[0]])
		{
			return state.error(null, 'Invalid amount of currencies found (' + currencies.length + ') for items ' + itemIds.join(', ') + '.', cb);
		}

		var currency = knownCurrencyMap[currencies[0]];

		// validate (will enable game logic to check the player's wallet)

		currency.callbacks.validate(state, totalPrice, function(error, invalidResponse) {
			if (error) return cb(error);

			if (invalidResponse)
			{
				return cb(null, invalidResponse);
			}

			// register transaction in shop purchase log

			var purchaseRequest = { status: 'new', shopName: shopName, items: itemInfo, time: mithril.core.time };

			if (forActorId)
			{
				purchaseRequest.forActorId = forActorId;
			}

			var sql = 'INSERT INTO shop_purchase VALUES(?, ?, ?, ?, ?, ?)';
			var params = [null, state.actorId, purchaseRequest.forActorId, purchaseRequest.time, null, purchaseRequest.status];

			state.datasources.db.exec(sql, params, null, function(error, info) {
				if (error) return cb(error);

				purchaseRequest.id = info.insertId;

				// register all items in the purchase log

				var sql = 'INSERT INTO shop_purchase_item VALUES ';
				var values = [];
				var params = [];

				for (var itemId in purchaseRequest.items)
				{
					var item = purchaseRequest.items[itemId];

					values.push('(?, ?, ?, ?, ?)');
					params.push(purchaseRequest.id, item.id, item.currencyId, item.unitPrice, item.quantity);
				}

				sql += values.join(', ');

				state.datasources.db.exec(sql, params, null, function(error, info) {
					if (error) return cb(error);

					currency.callbacks.start(state, purchaseRequest, function(error, response) {
						if (error) return cb(error);

						cb(null, response);
					});
				});
			});
		});
	});
};


exports.purchasePaid = function(state, purchaseId, cb)
{
	// logs the paid state.
	// creates any objects that should be spawned based on the item IDs in this purchase.

	var lastPurchase = {};

	async.series([
		function(callback) {
			// set purchase state to paid TODO: move this to after the following select?

			var sql = 'UPDATE shop_purchase SET status = ?, purchaseTime = ? WHERE id = ? AND status = ?';
			var params = ['paid', mithril.core.time, purchaseId, 'new'];

			state.datasources.db.exec(sql, params, null, callback);
		},
		function(callback) {
			// instantiate any objects that need to be created

			// fetch stuff for return in lastPurchase
			var query = 'SELECT spi.itemId, spi.quantity, s.name AS shopName FROM shop_purchase_item AS spi JOIN shop_item AS si ON spi.itemId = si.id JOIN shop as s ON si.shopId = s.id WHERE purchaseId = ?';
			var params = [purchaseId];

			state.datasources.db.getMany(query, params, null, function(error, rows) {
				if (error) return callback(error);

				var itemIds = rows.map(function(row) { return row.itemId; });

				var itemQuantities = {};
				var itemShops = {};

				var len = rows.length;
				for (var i=0; i < len; i++)
				{
					itemQuantities[rows[i].itemId] = ~~rows[i].quantity || 1;
					itemShops[rows[i].itemId] = rows[i].shopName; //this should never be nonsense
				}

				// fetch items
				exports.getItems(state, itemIds, null, function(error, items) {
					if (error) return callback(error);

					var itemsArr = [];
					for (var itemId in items)
					{
						itemsArr.push(items[itemId]);
						lastPurchase[itemId] = { quantity: itemQuantities[itemId], shop:itemShops[itemId] };
					}

					if (itemsArr.length == 0)
					{
						return callback();
					}

					// instantiate objects
					async.forEachSeries(
						// for each shop item

						itemsArr,
						function(item, callback2) {
							async.forEachSeries(

								// for each object to be instantiated

								item.objects,
								function(object, callback3) {

									// pick collections to add the new object to

									mithril.obj.hooks.chooseObjectCollections(state, object.className, function(error, collections) {
										if (error) return callback3(error);

										var tags = (object.tags.length > 0) ? object.tags.split(',') : [];

										// create the object

										mithril.obj.addObject(state, collections, object.className, null, new mithril.core.PropertyMap, tags, object.quantity * itemQuantities[item.id], function(error, ids) {
											if (error) return callback3(error);

											if (lastPurchase[item.id].objectIds)
											{
												lastPurchase[item.id].objectIds = lastPurchase[item.id].objectIds.concat(ids);
											}
											else
												lastPurchase[item.id].objectIds = ids;

											callback3();
										});
									});
								},
								callback2
							);
						},
						callback
					);
				});
			});
		}
	],
	function(error) {
		if (error) return cb(error);

		cb(null, lastPurchase);
	});
};


exports.purchaseExpired = function(state, purchaseId, cb)
{
	// logs the expired state.

	var sql = 'UPDATE shop_purchase SET status = ? WHERE id = ? AND status = ?';
	var params = ['expired', purchaseId, 'new'];

	state.datasources.db.exec(sql, params, null, function(error) {
		if (error) return cb(error);

		cb();
	});
};


exports.purchaseCancelled = function(state, purchaseId, cb)
{
	// logs the cancelled state.

	var sql = 'UPDATE shop_purchase SET status = ? WHERE id = ? AND status = ?';
	var params = ['cancelled', purchaseId, 'new'];

	state.datasources.db.exec(sql, params, null, function(error) {
		if (error) return cb(error);

		cb();
	});
};

