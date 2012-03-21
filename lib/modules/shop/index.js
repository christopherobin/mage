var mithril = require('../../mithril'),
    async   = require('async'),
	uuid    = require('node-uuid');


exports.getManageCommands = function () {
	return [
		'createShop',
		'editShop',
		'deleteShop',
		'getShops',
		'createItem',
		'editItem',
		'deleteItem',
		'createItemObject',
		'createItemObjects',
		'editItemObject',
		'deleteItemObject',
		'deleteItemObjects',
		'getPurchaseHistory',
		'sync'
	];
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
/*
 * previous api changed the items directly by giving them a quantity property and pushing data into the callback
		for (var itemId in data) {
			data[itemId].quantity = Math.max(~~items[itemId], 1);
		}
		cb(null, data);
*/

		var result = {};

		for (var itemId in data) {
			result[itemId] = {
				item: data[itemId],
				quantity: Math.max(~~items[itemId], 1)
			};
		}

		cb(null, result);
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


/*
function updateShopCache(action, shop) {
	var id         = shop.id;
	var identifier = shop.identifier;

	switch (action) {
	case 'add':
		if (!allShopsMap[id] && !allShopsIdentMap[identifier]) {
			allShopsMap[id]              = shop;
			allShopsIdentMap[identifier] = shop;
		} else {
			mithril.core.logger.error('Attempting to add shop that already exists : ', shop);
		}
		break;

	case 'edit':
		allShopsMap[id]              = shop;
		allShopsIdentMap[identifier] = shop;
		break;

	case 'del':
		delete allShops[id];
		delete allShopsIdentMap[identifier];
		break;

	default:
		break;
	}
}


function updateItemCache() {
	//TODO
}


function updateItemObjectCache() {
	//TODO
}
*/

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
				item.shops = [];
				item.objects = [];
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

		if (addShop) {
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


exports.getShopProperties = function (state, shopId, options, cb) {
	var sql    = 'SELECT property, language, type, value FROM shop_data WHERE shopId = ?';
	var params = [shopId];

	state.datasources.db.getMany(sql, params, null, cb);
};


exports.getShopItemObjectProperties = function (state, itemObjectId, options, cb) {
	var sql    = 'SELECT property, language, type, value FROM shop_item_object_data WHERE itemObjectId =?';
	var params = [itemObjectId];

	state.datasources.db.getMany(sql, params, null, cb);
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
		for (var skey in allShopsMap) {
			if (shopNames.indexOf(allShopsMap[skey].identifier) !== -1) {
				if (!allShopsMap[skey].items) {
					continue;
				}

				for (var i = 0, len = allShopsMap[skey].items.length; i < len; i++) {
					var itemId = allShopsMap[skey].items[i];
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

			// check total cost
			var totalPrice = 0;
			var currencies = [];
			var itemIds = [];
			var itemId, item, quantity;


			for (itemId in itemInfo) {
				itemIds.push(~~itemId);
				item = itemInfo[itemId].item;
				quantity = ~~itemInfo[itemId].quantity;

				totalPrice += ~~item.unitPrice * ~~quantity;

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
						var itemInfo = purchaseRequest.items[itemId];
						var item = itemInfo.item;
						var quantity = itemInfo.quantity;

						values.push('(?, ?, ?, ?, ?)');
						params.push(purchaseRequest.id, item.id, item.currencyId, item.unitPrice, quantity);
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
			var sql = 'SELECT sp.shopId, s.identifier AS shopIdentifier FROM shop_purchase AS sp JOIN shop AS s ON sp.shopId = s.id WHERE sp.id = ?';
			var params = [purchaseId];

			state.datasources.db.getOne(sql, params, true, null, function (error, row) {
				if (error) {
					return callback(error);
				}

				lastPurchase.shopId = row.shopId;
				lastPurchase.shopIdentifier = row.shopIdentifier;

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

											mithril.obj.addObject(state, o.className, null, tags, o.quantity * itemQuantity, function (error, results) {
												if (error) {
													return callback3(error);
												}
												var ids = [];
												for (var i = 0, len = results.length; i < len; i++) {
													ids.push(results[i].id);
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


// GM commands



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
		var properties = data;

		for (var prop in properties) {
			propMap.add(prop, (properties[prop].val || properties[prop]), (properties[prop].lang || ''), (properties[prop].tag || ''));
		}


		exports.setProperties(state, info.insertId, propMap, function (error) {
			if (error) {
				return cb(error);
			}

			prepCache(state, function (error) {	// TODO: being lazy here, need to update caches manually if I want performance
				if (error) {
					return cb(error);
				}

				cb(null, id);
			});
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
				var clearSql  = 'DELETE FROM shop_data WHERE shopId = ?';
				var clearArgs = [].concat([shop.id]);

				state.datasources.db.exec(clearSql, clearArgs, null, function (error) {
					if (error) {
						return callback(error);
					}

					// Add data

					var dataSql     = 'INSERT INTO shop_data (shopId, property, language, type, value) VALUES ';
					var frag        = [];
					var dataParams  = [];
					var len         = data.length;


					if (len === 0) {
						return callback();
					}


					for (var i = 0; i < len; i++) {
						var property = data[i];
						frag.push('(?, ?, ?, ?, ?)');
						dataParams.push(shop.id, property.property, property.language || '', property.type, property.value);
					}

					dataSql += frag.join(', ');

					state.datasources.db.exec(dataSql, dataParams, null, callback);

				});
			}
		], function (error) {
			if (error) {
				return cb(error);
			}

			prepCache(state, cb);	// TODO: update cache manually
		});

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

			state.datasources.db.exec(sqld, argsd, null, function (error) {
				if (error) {
					return cb(error);
				}

				prepCache(state, cb);	// TODO: update cache manually
			});
		});
	});
};


exports.addItem = function (state, identifier, prefix, currencyType, unitPrice, shopIdentifier, data, cb) {
	var sql  = 'INSERT INTO shop_item (identifier, status, currencyId, unitPrice) VALUES (?, ?, ?, ?)';
	var newId;

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

				newId = itemId;
				callback(null, itemId);
			});
		},
		function (itemId, callback) {
			// save item properties

			var dataSql     = 'INSERT INTO shop_item_data (itemId, property, language, type, value) VALUES ';
			var frag        = [];
			var dataParams  = [];
			var len         = data.length;


			if (len === 0) {
				return callback();
			}


			for (var i = 0; i < len; i++) {
				var property = data[i];
				frag.push('(?, ?, ?, ?, ?)');
				dataParams.push(itemId, property.property, property.language || '', property.type, property.value);
			}

			dataSql += frag.join(', ');

			state.datasources.db.exec(dataSql, dataParams, null, callback);

		}
	], function (error) {
		if (error) {
			return cb(error);
		}

		prepCache(state, function (error) {
			if (error) {
				return cb(error);
			}

			cb(null, newId);
		});
	});
};


exports.editItem = function (state, itemId, unitPrice, data, cb) {
	var sql  = 'UPDATE shop_item_data AS sid JOIN shop_item AS si ON si.id = sid.shopId SET sid.unitPrice = ? WHERE si.identifier = ?';
	var args = [unitPrice, itemId];


	async.waterfall([
		function (callback) {
			var sql  = 'UPDATE shop_item SET unitPrice = ? WHERE id = ?';
			var args = [unitPrice, itemId];

			state.datasources.db.exec(sql, args, null, function (error) {
				if (error) {
					return callback(error);
				}

				callback(null, itemId);
			});
		},
		function (itemId, callback) {
			// save item properties


			var clearSql  = 'DELETE FROM shop_item_data WHERE itemId = ?';
			var clearArgs = [itemId];

			state.datasources.db.exec(clearSql, clearArgs, null, function (error) {
				if (error) {
					return callback(error);
				}

				// Add data

				var dataSql     = 'INSERT INTO shop_item_data (itemId, property, language, type, value) VALUES ';
				var frag        = [];
				var dataParams  = [];
				var len         = data.length;


				if (len === 0) {
					return callback();
				}


				for (var i = 0; i < len; i++) {
					var property = data[i];
					frag.push('(?, ?, ?, ?, ?)');
					dataParams.push(itemId, property.property, property.language || '', property.type, property.value);
				}

				dataSql += frag.join(', ');

				state.datasources.db.exec(dataSql, dataParams, null, callback);

			});

		}
	], function (error) {
		if (error) {
			return cb(error);
		}

		prepCache(state, cb);
	});
};


exports.delItem = function (state, shopIdentifier, itemId, cb) {
	var sql  = 'DELETE si.* FROM shop_item AS si ';
	sql     += 'JOIN shop_item_shop AS sis ON si.id = sis.itemId ';
	sql     += 'JOIN shop AS s ON sis.shopId = s.id AND s.identifier = ? ';
	sql     += 'WHERE si.id = ?';
	var args = [shopIdentifier, itemId];


	state.datasources.db.exec(sql, args, null, function (error, info) {
		if (error) {
			return cb(error);
		}

		prepCache(state, cb);
	});
};


exports.addItemObject = function (state, itemId, className, quantity, tags, data, cb) {
	var newId;

	async.waterfall([
		function (callback) {
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
			// save item properties

			var dataSql     = 'INSERT INTO shop_item_object_data (itemObjectId, property, language, type, value) VALUES ';
			var frag        = [];
			var dataParams  = [];
			var len         = data.length;


			if (len === 0) {
				return callback();
			}


			for (var i = 0; i < len; i++) {
				var property = data[i];
				frag.push('(?, ?, ?, ?, ?)');
				dataParams.push(itemObjectId, property.property, property.language || '', property.type, property.value);
			}

			dataSql += frag.join(', ');

			state.datasources.db.exec(dataSql, dataParams, null, callback);
		}
	], function (error) {
		if (error) {
			return cb(error);
		}

		cb(null, newId);
	});
};


// TODO: this is broken!!!

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

		prepCache(state, cb);
	});
};


exports.delItemObject = function (state, id, cb) {
	var sql  = 'DELETE FROM shop_item_object WHERE id = ?';
	var args = [id];

	state.datasources.db.exec(sql, args, null, function (error) {
		if (error) {
			return cb(error);
		}

		prepCache(state, cb);
	});
};


exports.delItemObjects = function (state, ids, cb) {
	var sql  = 'DELETE FROM shop_item_object WHERE id in (' + state.datasources.db.getPlaceHolders(ids.length) + ')';

	state.datasources.db.exec(sql, ids, null, function (error) {
		if (error) {
			return cb(error);
		}

		prepCache(state, cb);
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

exports.getPurchaseHistory = function (state, fromTimeStamp, toTimeStamp, playerId, cb) {

	var db = state.datasources.db;

	var base = "SELECT sp.id, spi.itemId, si.identifier AS 'itemIdent', spi.currencyId, sc.identifier AS 'currencyName', spi.unitPrice, spi.quantity, sp.playerId, sp.forActorId, sp.shopId, s.identifier AS 'shopIdent', s.type, sp.creationTime, sp.purchaseTime, sp.status ";
	base += "FROM shop_purchase AS sp ";
	base += "JOIN shop AS s on sp.shopId = s.id ";
	base += "JOIN shop_purchase_item as spi ON sp.id = spi.purchaseId ";
	base += "JOIN shop_item AS si ON spi.itemId = si.id ";
	base += "JOIN shop_currency AS sc ON spi.currencyId = sc.id ";

	var where = [];
	var params = [];

	if (fromTimeStamp) {
		where.push(" purchaseTime > ?");
		params.push(fromTimeStamp);
	}
	if (toTimeStamp) {
		where.push(" purchaseTime < ?");
		params.push(toTimeStamp);
	}
	if (playerId) {
		where.push("playerId = ?");
		params.push(playerId);
	}

	if (where.length) {
		base += 'WHERE ' + where.join(' AND ');
	}

	db.getMany(base, params, null, function (err, rows) {
		if (err) {
			return cb(err);
		}
		cb(null, rows);
	});

};

