var mithril = require('../../mithril'),
    async = require('async');


function defaultGetGenericPurchaseMessage() {
	return '';
}


function defaultShopItemValidator(state, shop, items, cb) {
	var itemIds = [];

	for (var itemId in items) {
		itemIds.push(~~itemId);
	}

	exports.getItems(state, itemIds, [shop.name], function (err, data) {
		if (err) {
			return cb(err);
		}

		for (var itemId in data) {
			data[itemId].quantity = Math.max(~~items[itemId], 1);
		}

		cb(null, data);
	});
}

function defaultChooseItemObjects(state, shopId, item, cb) {
	cb(null, item.objects);
}


exports.hooks = {
	getGenericPurchaseMessage: defaultGetGenericPurchaseMessage,
	validateItemChoice: defaultShopItemValidator,
	chooseItemObjects: defaultChooseItemObjects
};


// knownCurrencyMap: { identifier: { id: 123, callbacks: { validate: fn, start: fn } } }

var knownCurrencyMap = {};


function registerCurrency(identifier, id, callbacks) {
	if (!callbacks.validate) {
		return false;
	}

	if (!callbacks.start) {
		return false;
	}

	knownCurrencyMap[identifier] = { id: id, callbacks: callbacks };

	return true;
}


exports.enforceCurrency = function (state, identifier, callbacks, cb) {
	// returns the ID of the given currency identifier.
	// if the identifier does not exist, it will be created and its ID will be returned.

	var sql = 'INSERT IGNORE INTO shop_currency (identifier) VALUES (?)';
	var params = [identifier];

	state.datasources.db.exec(sql, params, null, function (error, info) {
		if (error) {
			return cb(error);
		}

		if (info.insertId) {
			if (!registerCurrency(identifier, info.insertId, callbacks)) {
				return state.error(null, 'Failed to register currency: ' + identifier, cb);
			}

			return cb();
		}

		exports.getCurrencyId(state, identifier, function (error, id) {
			if (!registerCurrency(identifier, id, callbacks)) {
				return state.error(null, 'Failed to register currency: ' + identifier, cb);
			}

			cb();
		});
	});
};


exports.getCurrencyId = function (state, identifier, cb) {
	var query = 'SELECT id FROM shop_currency WHERE identifier = ?';
	var params = [identifier];

	state.datasources.db.getOne(query, params, true, null, function (error, row) {
		if (error) {
			return cb(error);
		}

		cb(null, row.id);
	});
};


exports.getShops = function (state, options, cb) {
	options = options || {};

	var sql = 'SELECT id, name, type FROM shop';
	var params = [];
	var where = [];

	if (options.type) {
		where.push('type = ?');
		params.push(options.type);
	}

	if (where.length > 0) {
		sql += ' WHERE ' + where.join(' AND ');
	}

	state.datasources.db.getMany(sql, params, null, function (error, shops) {
		if (error) {
			return cb(error);
		}

		if (options.propertyOptions) {
			var shopIds = [];

			for (var i = 0, len = shops.length; i < len; i++) {
				shopIds.push(shops[i].id);
			}

			var config = {
				tableName: 'shop_data',
				columns: ['shopId', 'property', 'language', 'type', 'value'],
				fixedValues: { shopId: shopIds },
				key: 'shopId'
			};

			mithril.core.LivePropertyMap.createMany(state, config, options.propertyOptions, function (error, maps) {
				if (error) {
					return cb(error);
				}

				for (var i = 0, len = shops.length; i < len; i++) {
					var shop = shops[i];
					var map = maps[shop.id];

					if (map) {
						shop.data = map;
					}
				}

				cb(null, shops);
			});
		} else {
			cb(null, shops);
		}
	});
};


exports.getShopById = function (state, id, cb) {
	var sql = 'SELECT id, name, type FROM shop WHERE id = ?';
	var params = [id];

	state.datasources.db.getOne(sql, params, true, null, cb);
};


exports.getShopByName = function (state, name, cb) {
	var sql = 'SELECT id, name, type FROM shop WHERE name = ?';
	var params = [name];

	state.datasources.db.getOne(sql, params, true, null, cb);
};


exports.getShopProperties = function (state, shopId, options, cb) {
	var config = {
		tableName: 'shop_data',
		columns: ['shopId', 'property', 'language', 'type', 'value'],
		fixedValues: { shopId: shopId }
	};

	mithril.core.LivePropertyMap.create(state, config, options, cb);
};


exports.getShopItemObjectProperties = function (state, itemObjectId, options, cb) {
	var config = {
		tableName: 'shop_item_object_data',
		columns: ['itemObjectId', 'property', 'language', 'type', 'value'],
		fixedValues: { itemObjectId: itemObjectId }
	};

	mithril.core.LivePropertyMap.create(state, config, options, cb);
};


exports.getItems = function (state, itemIds, shopNames, cb) {
	// if no itemIds given, all items will be returned, if no shopName given, all will return

	var db = state.datasources.db;

	var sql = 'SELECT DISTINCT i.id, i.identifier, i.status, i.currencyId, i.unitPrice, c.identifier AS currencyIdentifier FROM shop_currency AS c JOIN shop_item AS i ON i.currencyId = c.id';
	var params = [];
	var where = [];

	if (shopNames) {
		sql += ' JOIN shop_item_shop AS sis ON sis.itemId = i.id JOIN shop AS s ON s.id = sis.shopId';
		where.push('s.name IN (' + db.getPlaceHolders(shopNames.length) + ')');
		params = params.concat(shopNames);
	}

	if (itemIds && itemIds.length > 0) {
		where.push('i.id IN (' + db.getPlaceHolders(itemIds.length) + ')');
		params = params.concat(itemIds);
	}

	if (where.length > 0) {
		sql += ' WHERE ' + where.join(' AND ');
	}

	db.getMany(sql, params.concat([]), null, function (error, rows) {
		if (error) {
			return cb(error);
		}

		var result = {};

		var len = rows.length;

		// if empty, return the empty set

		if (len === 0) {
			return cb(null, result);
		}

		// (over)write itemIds to the real found itemIds

		itemIds = rows.map(function (row) {
			return row.id;
		});

		// make item objects

		for (var i = 0; i < len; i++) {
			var row = rows[i];

			row.data = new mithril.core.PropertyMap();
			row.objects = [];

			result[row.id] = row;
		}

		// for each item, get data

		var sql = 'SELECT itemId, property, language, type, value FROM shop_item_data WHERE itemId IN (' + db.getPlaceHolders(itemIds.length) + ')';
		var params = [].concat(itemIds);

		db.getMany(sql, params, null, function (error, rows) {
			if (error) {
				return cb(error);
			}

			for (var i = 0, len = rows.length; i < len; i++) {
				var row = rows[i];

				result[row.itemId].data.importOne(row.property, row.type, row.value, row.language);
			}

			// for each item, get object instantiation info

			var sql = 'SELECT itemId, id, className, quantity, tags FROM shop_item_object WHERE itemId IN (' + db.getPlaceHolders(itemIds.length) + ')';
			var params = [].concat(itemIds);

			db.getMany(sql, params, null, function (error, objects) {
				if (error) {
					return cb(error);
				}

				// if there were no objects definitions, bail out now

				if (objects.length === 0) {
					return cb(null, result);
				}

				var itemObjectIds = [];

				for (var i = 0, len = objects.length; i < len; i++) {
					var o = objects[i];

					var itemId = o.itemId;
					delete o.itemId;

					result[itemId].objects.push(o);
					itemObjectIds.push(o.id);
				}

				// add property map on top of object instantiation records

				var config = {
					tableName: 'shop_item_object_data',
					columns: ['itemObjectId', 'property', 'language', 'type', 'value'],
					fixedValues: { itemObjectId: itemObjectIds },
					key: 'itemObjectId'
				};

				var options = {
					loadAll: true,
					allLanguages: true
				};

				mithril.core.LivePropertyMap.createMany(state, config, options, function (error, maps) {
					if (error) {
						return cb(error);
					}

					for (var i = 0, len = objects.length; i < len; i++) {
						var o = objects[i];
						var map = maps[o.id];

						if (map) {
							o.data = map;
						}
					}

					cb(null, result);
				});
			});
		});
	});
};


exports.startPurchase = function (state, forActorId, shopName, items, cb) {
	// this method starts a purchase process
	// it is required that all requested items share the same currency

	// items: { itemId: qty, itemId, qty, ... }

	if (!forActorId || ~~forActorId === state.actorId) {
		forActorId = null;
	}

	exports.getShopByName(state, shopName, function (error, shop) {
		if (error) {
			return cb(error);
		}

		exports.hooks.validateItemChoice(state, shop, items, function (error, itemInfo) {
			if (error) {
				return cb(error);
			}

			if (!itemInfo) {
				return state.error('badchoice', 'No items found for purchase on shop: ' + shopName, cb);
			}

			var itemIds = [];
			var itemId;

			for (itemId in itemInfo) {
				itemIds.push(~~itemId);
			}

			// check total cost

			var totalPrice = 0;
			var currencies = [];

			for (itemId in itemInfo) {
				var item = itemInfo[itemId];

				totalPrice += ~~item.unitPrice * ~~item.quantity;

				if (currencies.indexOf(item.currencyIdentifier) === -1) {
					currencies.push(item.currencyIdentifier);
				}
			}

			// check the currency that is being used

			if (currencies.length !== 1 || !knownCurrencyMap[currencies[0]]) {
				return state.error(null, 'Invalid amount of currencies found (' + currencies.length + ') for items ' + itemIds.join(', ') + '.', cb);
			}

			var currency = knownCurrencyMap[currencies[0]];

			// validate (will enable game logic to check the player's wallet)

			currency.callbacks.validate(state, totalPrice, function (error, invalidResponse) {
				if (error) {
					return cb(error);
				}

				if (invalidResponse) {
					return cb(null, invalidResponse);
				}

				// register transaction in shop purchase log

				var purchaseRequest = {
					status: 'new',
					shopName: shop.name,
					items: itemInfo,
					time: mithril.core.time
				};

				if (forActorId) {
					purchaseRequest.forActorId = forActorId;
				}

				var sql = 'INSERT INTO shop_purchase VALUES (?, ?, ?, ?, ?, ?, ?)';
				var params = [null, state.actorId, purchaseRequest.forActorId, shop.id, purchaseRequest.time, null, purchaseRequest.status];

				state.datasources.db.exec(sql, params, null, function (error, info) {
					if (error) {
						return cb(error);
					}

					purchaseRequest.id = info.insertId;

					// register all items in the purchase log

					var sql = 'INSERT INTO shop_purchase_item VALUES ';
					var values = [];
					var params = [];

					for (var itemId in purchaseRequest.items) {
						var item = purchaseRequest.items[itemId];

						values.push('(?, ?, ?, ?, ?)');
						params.push(purchaseRequest.id, item.id, item.currencyId, item.unitPrice, item.quantity);
					}

					sql += values.join(', ');

					state.datasources.db.exec(sql, params, null, function (error) {
						if (error) {
							return cb(error);
						}

						currency.callbacks.start(state, purchaseRequest, function (error, response) {
							if (error) {
								return cb(error);
							}

							cb(null, response);
						});
					});
				});
			});
		});
	});
};


exports.purchasePaid = function (state, purchaseId, cb) {
	// logs the paid state.
	// creates any objects that should be spawned based on the item IDs in this purchase.

	var lastPurchase = {
		items: {},
	};

	async.series([
		function (callback) {
			var sql = 'SELECT shopId FROM shop_purchase WHERE id = ?';
			var params = [purchaseId];

			state.datasources.db.getOne(sql, params, true, null, function (error, row) {
				if (error) {
					return callback(error);
				}

				lastPurchase.shopId = row.shopId;

				callback();
			});
		},
		function (callback) {
			// set purchase state to paid
			// TODO: move this to after the following select?

			var sql = 'UPDATE shop_purchase SET status = ?, purchaseTime = ? WHERE id = ? AND status = ?';
			var params = ['paid', mithril.core.time, purchaseId, 'new'];

			state.datasources.db.exec(sql, params, null, callback);
		},
		function (callback) {
			// instantiate any objects that need to be created

			// fetch stuff for return in lastPurchase

			var query = 'SELECT itemId, quantity FROM shop_purchase_item WHERE purchaseId = ?';
			var params = [purchaseId];

			state.datasources.db.getMany(query, params, null, function (error, rows) {
				if (error) {
					return callback(error);
				}

				var itemIds = rows.map(function (row) {
					return row.itemId;
				});

				var itemQuantities = {};

				for (var i = 0, len = rows.length; i < len; i++) {
					var row = rows[i];

					itemQuantities[row.itemId] = ~~row.quantity || 1;
				}

				// fetch items

				exports.getItems(state, itemIds, null, function (error, items) {
					if (error) {
						return callback(error);
					}

					var itemsArr = [];

					for (var itemId in items) {
						itemsArr.push(items[itemId]);
						lastPurchase.items[itemId] = { quantity: itemQuantities[itemId] };
					}

					if (itemsArr.length === 0) {
						return callback();
					}

					// instantiate objects

					async.forEachSeries(
						// for each shop item

						itemsArr,
						function (item, callback2) {
							var itemQuantity = itemQuantities[item.id];

							exports.hooks.chooseItemObjects(state, lastPurchase.shopId, item, function (error, objects) {
								if (error) {
									return callback2(error);
								}

								async.forEachSeries(
									// for each object to be instantiated
									objects,
									function (o, callback3) {

										// pick collections to add the new object to

										mithril.obj.hooks.chooseObjectCollections(state, o.className, function (error, collections) {
											if (error) {
												return callback3(error);
											}

											var tags = (o.tags.length > 0) ? o.tags.split(',') : [];

											// create the object

											mithril.obj.addObject(state, collections, o.className, null, new mithril.core.PropertyMap(), tags, o.quantity * itemQuantity, function (error, ids) {
												if (error) {
													return callback3(error);
												}

												var lpItem = lastPurchase.items[item.id];
												if (lpItem) {
													if (lpItem.objectIds) {
														lpItem.objectIds = lpItem.objectIds.concat(ids);
													} else {
														lpItem.objectIds = ids;
													}
												}

												callback3();
											});
										});
									},
									callback2
								);
							});
						},
						callback
					);
				});
			});
		}
	],
	function (error) {
		if (error) {
			return cb(error);
		}

		cb(null, lastPurchase);
	});
};


exports.purchaseExpired = function (state, purchaseId, cb) {
	// logs the expired state.

	var sql = 'UPDATE shop_purchase SET status = ? WHERE id = ? AND status = ?';
	var params = ['expired', purchaseId, 'new'];

	state.datasources.db.exec(sql, params, null, function (error) {
		if (error) {
			return cb(error);
		}

		cb();
	});
};


exports.purchaseCancelled = function (state, purchaseId, cb) {
	// logs the cancelled state.

	var sql = 'UPDATE shop_purchase SET status = ? WHERE id = ? AND status = ?';
	var params = ['cancelled', purchaseId, 'new'];

	state.datasources.db.exec(sql, params, null, function (error) {
		if (error) {
			return cb(error);
		}

		cb();
	});
};

