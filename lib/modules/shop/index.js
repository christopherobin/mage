var mithril = require('../../mithril'),
    async   = require('async'),
	uuid    = require('node-uuid');


exports.getManageCommands = function () {
	return ['createShop', 'editShop', 'deleteShop', 'getShops', 'createItem', 'editItem', 'deleteItem', 'createItemObject', 'createItemObjects', 'editItemObject', 'deleteItemObject', 'deleteItemObjects'];
};


function defaultGetGenericPurchaseMessage() {
	return '';
}


function defaultShopItemValidator(state, shop, items, cb) {
	var itemIds = [];

	for (var itemId in items) {
		itemIds.push(~~itemId);
	}

	exports.getItems(state, itemIds, [shop.identifier], function (err, data) {
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


function defaultOnPurchasePaid(state, lastPurchase, cb) {
	cb();
}


exports.hooks = {
	getGenericPurchaseMessage: defaultGetGenericPurchaseMessage,
	validateItemChoice: defaultShopItemValidator,
	chooseItemObjects: defaultChooseItemObjects,
	onPurchasePaid: defaultOnPurchasePaid
};


// knownCurrencyMap: { identifier: { id: 123, callbacks: { validate: fn, start: fn } } }

var knownCurrencyMap = {};
var allShopsMap = {};
var allItemsMap = {};
var allItemObjectsMap = {};
var allShopsIdentMap = {};


function loadData(state, parentMap, keyField, table, cb) {
	var query = 'SELECT ' + keyField + ', property, language, type, value FROM ' + table;

	state.datasources.db.getMany(query, [], null, function (err, results) {
		if (err) {
			return cb(err);
		}

		for (var key in parentMap) {
			parentMap[key].data = new mithril.core.PropertyMap();
		}

		for (var i = 0, len = results.length; i < len; i++) {
			var row = results[i];

			if (row[keyField] in parentMap) {
				parentMap[row[keyField]].data.importOne(row.property, row.type, row.value, row.language);
			}
		}

		cb();
	});
}



function prepCache(state, cb) {


	async.waterfall([
		function (callback) {
			var sql = 'SELECT id, identifier, type FROM shop';
			state.datasources.db.getMany(sql, [], null, callback);
		},
		function (shops, callback) {
			for (var i = 0, len = shops.length; i < len; i++) {
				var shop = shops[i];
				allShopsMap[shop.id] = shop;
				allShopsIdentMap[shop.identifier] = shop;
			}
			loadData(state, allShopsMap, 'shopId', 'shop_data', callback);
		},
		function (callback) {
			var sql = 'SELECT si.id, si.identifier, si.status, si.currencyId, sc.identifier AS currencyIdentifier, si.unitPrice FROM shop_item AS si JOIN shop_currency AS sc ON si.currencyId = sc.id';
			state.datasources.db.getMany(sql, [], null, callback);
		},
		function (items, callback) {
			for (var i = 0, len = items.length; i < len; i++) {
				var item = items[i];
				allItemsMap[item.id] = item;
			}
			loadData(state, allItemsMap, 'itemId', 'shop_item_data', callback);
		},
		function (callback) {
			var sql = 'SELECT shopId, itemId, sortIndex FROM shop_item_shop';
			var params = [];
			state.datasources.db.getMany(sql, params, null, callback);
		},
		function (shopItems, callback) {
			for (var i = 0, len = shopItems.length; i < len; i++) {
				var shopItem = shopItems[i];
				if (!allShopsMap[shopItem.shopId].hasOwnProperty('items')) {
					allShopsMap[shopItem.shopId].items = [];
				}
				if (!allItemsMap[shopItem.itemId].hasOwnProperty('shops')) {
					allItemsMap[shopItem.itemId].shops = [];
				}
				allShopsMap[shopItem.shopId].items.push(shopItem.itemId); //TODO: implement sortIndex here
				allItemsMap[shopItem.itemId].shops.push(shopItem.shopId);
			}
			var sql = 'SELECT id, itemId, className, quantity, tags FROM shop_item_object';
			state.datasources.db.getMany(sql, [], null, callback);
		},
		function (itemObjects, callback) {
			for (var i = 0, len = itemObjects.length; i < len; i++) {
				var itemObject = itemObjects[i];
				allItemObjectsMap[itemObject.id] = itemObject;
				if (!allItemsMap[itemObject.itemId].hasOwnProperty('objects')) {
					allItemsMap[itemObject.itemId].objects = [];
				}
				allItemsMap[itemObject.itemId].objects.push(itemObject);
			}
			loadData(state, allItemObjectsMap, 'itemObjectId', 'shop_item_object_data', callback);
		}
	], cb);
}


exports.setup = function (state, cb) {
	prepCache(state, cb);
};


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

	var ot =  options && options.type || null;
	var on = options && options.names || null;
	var result = [];

	for (var id in allShopsMap) {

		var shop = allShopsMap[id];
		var sn = shop.name;
		var st = shop.type;

		var addShop = ((ot && on && st === ot && on.indexOf(sn) !== -1) || (ot && !on && st === ot) || (!ot && on && on.indexOf(sn) !== -1) || (!ot && !on));

		if(addShop) {
			result.push(allShopsMap[id]);
		}
	}
	cb(null, result);
};


exports.getShopById = function (state, id, cb) {
	cb(null, allShopsMap[id]);
};


exports.getShopByIdentifier = function (state, identifier, cb) {
	cb(null, allShopsIdentMap[identifier]);
};


exports.getShopsByContainedItem = function (state, itemId, cb) {
	var results = [];

	for (var id in allShopsMap) {
		var shop = allShopsMap[id];
		if (shop.items.indexOf(itemId) !== -1) {
			results.push(shop);
		}
	}
	cb(null, results);
};


exports.getItems = function (state, itemIds, shopNames, cb) {
	var result = {};

	if (!shopNames) {
		//get all matching itemIds
		for (var key in allItemsMap) {
			if (itemIds.indexOf(~~key) !== -1) {
				result[key] = allItemsMap[key];
			}
		}
	} else {
		//loop shops, get all Items
		for (var key in allShopsMap) {
			if (shopNames.indexOf(allShopsMap[key].identifier) !== -1) {
				for (var i = 0, len = allShopsMap[key].items.length; i < len; i++) {
					var itemId = allShopsMap[key].items[i];
					var allowedItemId = (!itemIds) ? true : itemIds.indexOf(~~itemId) !== -1;
					if (!result.hasOwnProperty(itemId) && allowedItemId) {
						result[itemId] = allItemsMap[itemId];
					}
				}
			}
		}
	}
	cb(null, result);
};


exports.findItemIdWithProperty = function (state, propertyName, value, cb) {
	// returns: {
	//   id: itemId,
	//   shopNames: ['name1', 'name2']
	// }

	var sql = 'SELECT itemId FROM shop_item_data WHERE property = ? AND value = ? LIMIT 1';
	var params = [propertyName, value];

	state.datasources.db.getOne(sql, params, false, null, function (error, row) {
		if (error) {
			return cb(error);
		}

		if (row) {
			cb(null, row.itemId);
		} else {
			cb(null, null);
		}
	});
};


exports.startPurchase = function (state, forActorId, shopIdentifier, items, cb) {
	// this method starts a purchase process
	// it is required that all requested items share the same currency

	// items: { itemId: qty, itemId, qty, ... }

	if (!forActorId || ~~forActorId === state.actorId) {
		forActorId = null;
	}

	exports.getShopByIdentifier(state, shopIdentifier, function (error, shop) {
		if (error) {
			return cb(error);
		}
		exports.hooks.validateItemChoice(state, shop, items, function (error, itemInfo) {
			if (error) {
				return cb(error);
			}

			if (!itemInfo) {
				return state.error('badchoice', 'No items found for purchase on shop: ' + shopIdentifier, cb);
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
					shopIdentifier: shop.identifier,
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
		items: {}
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

			var query = 'SELECT i.itemId, i.unitPrice, c.identifier AS currency, i.quantity FROM shop_purchase_item AS i JOIN shop_currency AS c ON c.id = i.currencyId WHERE i.purchaseId = ?';
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
					var itemId = row.itemId;
					delete row.itemId;

					itemQuantities[itemId] = ~~row.quantity || 1;
					lastPurchase.items[itemId] = row;
				}

				// fetch items
				exports.getItems(state, itemIds, null, function (error, items) {
					if (error) {
						return callback(error);
					}

					var itemsArr = [];

					for (var itemId in items) {
						itemsArr.push(items[itemId]);
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

										mithril.obj.hooks.chooseObjectCollection(state, o.className, function (error, collectionId) {
											if (error) {
												return callback3(error);
											}

											var tags = (o.tags.length > 0) ? o.tags.split(',') : [];

											// create the object

											mithril.obj.addObject(state, o.className, null, new mithril.core.PropertyMap(), tags, o.quantity * itemQuantity, function (error, ids) {
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

												if (collectionId) {
													var options = {};	// the options that addObjectsToCollection receives do not make sense to use in this context

													var collectionObjects = ids.map(function (id) {
														return { id: id };
													});

													mithril.obj.addObjectsToCollection(state, collectionObjects, collectionId, options, callback3);
												} else {
													callback3();
												}
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

		// if someone's listening for the paid event, they can respond here

		exports.hooks.onPurchasePaid(state, lastPurchase, function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, lastPurchase);
		});
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


exports.addShop = function (state, identifier, prefix, type, data, cb) {
	var sql  = 'INSERT INTO shop (identifier, type) VALUES (?, ?)';
	var id;
	// if identifier given, use that, or else use [prefix] + uuid
	if (identifier) {
		id = identifier;
	} else if (prefix) {
		id = prefix + uuid();
	} else {
		id = uuid();
	}

	var args = [id, type];

	state.datasources.db.exec(sql, args, null, function (error, info) {
		if (error) {
			return cb(error);
		}

		var propMap = new mithril.core.PropertyMap();
		var properties = params.data;

		for (var prop in properties) {
			propMap.add(prop, (properties[prop].val || properties[prop]), (properties[prop].lang || ''), (properties[prop].tag || ''));
		}


		exports.setProperties(state, info.insertId, propMap, function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, id);
		});
	});
};


exports.editShop = function (state, identifier, type, data, cb) {
	// params = { prefix: 'gacha:', type: 'gacha_free', data: { priority: 4, name: 'blah, hours: [[], []], recurring: [{}, {}]  } };   'ish

	exports.getShopByIdentifier(state, identifier, function (error, shop) {
		var sql  = 'UPDATE shop SET type = ? WHERE identifier = ?';
		var args = [type, identifier];

		async.series([
			function (callback) {
				state.datasources.db.exec(sql, args, null, function (error) {
					if (error) {
						return callback(error);
					}

					callback(error);
				});
			},
			function (callback) {
				exports.getShopProperties(state, shop.id, { loadAll: true }, function (error, propMap) {
					if (error) {
						return callback(error);
					}

					for (var mProp in propMap.data) {
						if (!(mProp in data)) {
							propMap.del(mProp, '', '');
						}
					}

					// sets params data as either prop: { val: val, lang: lang, tag: tag} or just the value prop: val
					for (var prop in data) {
						propMap.set(prop, data[prop].val || data[prop], data[prop].lang || '', data[prop].tag || '');
					}

					propMap.save(function (error) {
						if (error) {
							return callback(error);
						}
						callback();
					});
				});
			}
		], cb);

	});
};


exports.delShop = function (state, identifier, cb) {
	var sql  = 'DELETE si.* FROM shop_item AS si JOIN shop_item_shop AS sis ON sis.itemId = si.id WHERE sis.shopId = ?';


	exports.getShopByIdentifier(state, identifier, function (error, result) {
		if (error) {
			return cb(error);
		}

		var args = [result.id];
		state.datasources.db.exec(sql, args, null, function (error, info) {
			if (error) {
				return cb(error);
			}

			var sqld  = 'DELETE FROM shop WHERE identifier = ?';
			var argsd = [identifier];

			state.datasources.db.exec(sqld, argsd, null, cb);
		});
	});
};


exports.addItem = function (state, identifier, prefix, currencyType, unitPrice, shopIdentifier, data, cb) {
	var sql  = 'INSERT INTO shop_item (identifier, status, currencyId, unitPrice) VALUES (?, ?, ?, ?)';

	// if identifier given, use that, or else use [prefix] + uuid
	var id;

	if (identifier) {
		id = identifier;
	} else if (prefix) {
		id = prefix + uuid();
	} else {
		id = uuid();
	}

	var args = [id, 'visible', knownCurrencyMap[currencyType].id, unitPrice];

	async.waterfall([
		function (callback) {
			exports.getShopByIdentifier(state, shopIdentifier, function (error, result) {
				if (error) {
					return callback(error);
				}

				callback(null, result.id);
			});
		},
		function (shopId, callback) {
			// insert Item, return itemId, shopId
			state.datasources.db.exec(sql, args, null, function (error, info) {
				if (error) {
					return callback(error);
				}

				callback(null, info.insertId, shopId);
			});
		},
		function (itemId, shopId, callback) {
			// add shop_item_shop link, return itemid
			var sisSql  = 'INSERT INTO shop_item_shop VALUES (?, ?, ?)';
			var sisArgs = [shopId, itemId, null];

			state.datasources.db.exec(sisSql, sisArgs, null, function (error) {
				if (error) {
					return callback(error);
				}

				callback(null, itemId);
			});
		},
		function (itemId, callback) {
			// save item properties
			var config = {
				tableName: 'shop_item_data',
				columns: ['itemId', 'property', 'language', 'type', 'value'],
				fixedValues: { itemId: itemId },
				key: 'itemId'
			};

			mithril.core.LivePropertyMap.create(state, config, { loadAll: true }, function (error, map) {
				if (error) {
					return callback(error);
				}

				for (var prop in data) {
					map.set(prop, data[prop].val || data[prop], data[prop].lang || '', data[prop].tag || '');
				}

				map.save(function (error) {
					if (error) {
						return callback(error);
					}

					callback(null, id);
				});
			});
		}
	], cb);
};


exports.editItem = function (state, itemIdentifier, unitPrice, data, cb) {
	var sql  = 'UPDATE shop_item_data AS sid JOIN shop_item AS si ON si.id = sid.shopId SET sid.unitPrice = ? WHERE si.identifier = ?';
	var args = [unitPrice, itemIdentifier];


	async.waterfall([
		function (callback) {
			var sql  = 'SELECT id FROM shop_item WHERE identifier = ?';
			var args = [itemIdentifier];
			state.datasources.db.exec(sql, args, null, function (error, id) {
				if (error) {
					return callback(error);
				}

				callback(null, id);
			});
		},
		function (itemId, callback) {
			var sql  = 'UPDATE shop_item SET unitPrice = ? WHERE id = ?';
			var args = [unitPrice, itemId[0].id];

			state.datasources.db.exec(sql, args, null, function (error) {
				if (error) {
					return callback(error);
				}

				callback(null, itemId[0].id);
			});
		},
		function (itemId, callback) {
			var config = {
				tableName: 'shop_item_data',
				columns: ['itemId', 'property', 'language', 'type', 'value'],
				fixedValues: { itemId: itemId },
				key: 'itemId'
			};


			mithril.core.LivePropertyMap.create(state, config, { loadAll: true }, function (error, map) {
				if (error) {
					return callback(error);
				}

				for (var prop in data) {
					map.set(prop, data[prop].val || data[prop], data[prop].lang || '', data[prop].tag || '');
				}

				map.save(function (error) {
					if (error) {
						return callback(error);
					}

					callback();
				});
			});
		}
	], cb);
};


exports.delItem = function (state, shopIdentifier, itemIdentifier, cb) {
	var sql  = 'DELETE si.* FROM shop_item AS si ';
	sql     += 'JOIN shop_item_shop AS sis ON si.id = sis.itemId ';
	sql     += 'JOIN shop AS s ON sis.shopId = s.id AND s.identifier = ? ';
	sql     += 'WHERE si.identifier = ?';
	var args = [shopIdentifier, itemIdentifier];


	state.datasources.db.exec(sql, args, null, function (error, info) {
		if (error) {
			return cb(error);
		}

		cb();
	});
};


exports.addItemObject = function (state, itemIdentifier, className, quantity, tags, data, cb) {

	async.waterfall([
		function (callback) {
			var sql  = 'SELECT id FROM shop_item WHERE identifier = ?';
			var args = [itemIdentifier];

			state.datasources.db.getOne(sql, args, true, null, function (error, result) {
				if (error) {
					return callback(error);
				}

				callback(null, result.id);
			});
		},
		function (itemId, callback) {
			var sql  = 'INSERT INTO shop_item_object (itemId, className, quantity, tags) VALUES (?, ?, ?, ?)';
			var args = [itemId, className, quantity, (tags || '')];

			state.datasources.db.exec(sql, args, null, function (error, info) {
				if (error) {
					return callback(error);
				}

				callback(null, info.insertId);
			});
		},
		function (itemObjectId, callback) {
			var config = {
				tableName: 'shop_item_object_data',
				columns: ['itemObjectId', 'property', 'language', 'type', 'value'],
				fixedValues: { itemObjectId: itemObjectId },
				key: 'itemObjectId'
			};


			mithril.core.LivePropertyMap.create(state, config, { loadAll: true }, function (error, map) {
				if (error) {
					return callback(error);
				}

				for (var prop in data) {
					map.set(prop, data[prop].val || data[prop], data[prop].lang || '', data[prop].tag || '');
				}

				map.save(function (error) {
					if (error) {
						return callback(error);
					}

					callback(null, itemObjectId);
				});
			});
		}
	], cb);
};


exports.editItemObject = function (state, id, data, cb) {
	var config = {
		tableName: 'shop_item_object_data',
		columns: ['itemObjectId', 'property', 'language', 'type', 'value'],
		fixedValues: { itemObjectId: id },
		key: 'itemObjectId'
	};


	mithril.core.LivePropertyMap.create(state, config, { loadAll: true }, function (error, map) {
		if (error) {
			return cb(error);
		}

		for (var prop in data) {
			map.set(prop, data[prop].val || data[prop], data[prop].lang || '', data[prop].tag || '');
		}

		map.save(function (error) {
			if (error) {
				return cb(error);
			}

			cb();
		});
	});
};


exports.delItemObject = function (state, id, cb) {
	var sql  = 'DELETE FROM shop_item_object WHERE id = ?';
	var args = [id];

	state.datasources.db.exec(sql, args, null, function (error) {
		if (error) {
			return cb(error);
		}

		cb();
	});
};


exports.delItemObjects = function (state, ids, cb) {
	var sql  = 'DELETE FROM shop_item_object WHERE id in (' + state.datasources.db.getPlaceHolders(ids.length) + ')';

	state.datasources.db.exec(sql, ids, null, function (error) {
		if (error) {
			return cb(error);
		}

		cb();
	});
};


exports.setProperties = function (state, shopId, propMap, cb) {
	var properties = propMap.getAllFlat(true, true);
	var len        = properties.length;
	var check      = [];

	if (len === 0) {
		return cb();
	}

	var sql = 'INSERT INTO shop_data VALUES';

	var values = [];
	var params = [];

	for (var i = 0; i < len; i++) {
		var prop = properties[i];

		values.push('(?, ?, ?, ?, ?)');
		params.push(shopId, prop.property, prop.language || '', prop.type, prop.value);
		check.push(prop.property);
	}

	sql += values.join(', ') + ' ON DUPLICATE KEY UPDATE value = VALUES(value)';

	async.series([
		function (callback) {
			state.datasources.db.exec(sql, params, null, function (error) {
				if (error) {
					return cb(error);
				}

				state.emit(shopId, 'shop.data.edit', { properties: propMap.getAll(state.language()) });
				callback();
			});
		},
		function (callback) {
			var delProps = [];
			if (check.indexOf('recurring') === -1) {
				delProps.push('recurring');
			}

			if (check.indexOf('hours') === -1) {
				delProps.push('hours');
			}

			if (delProps.length > 0) {
				exports.delProperties(state, shopId, delProps, function (error) {
					if (error) {
						return callback(error);
					}

					callback();
				});
			} else {
				callback();
			}
		}
	], cb);
};

exports.delProperties = function (state, shopId, properties, cb) {
	var db = state.datasources.db;

	var sql = 'DELETE FROM shop_data WHERE shopId = ? AND property IN (' + db.getPlaceHolders(properties.length) + ')';
	var params = [shopId].concat(properties);

	db.exec(sql, params, null, function (error) {
		if (error) {
			return cb(error);
		}

		state.emit(shopId, 'shop.data.del', { properties: properties });

		cb();
	});
};

