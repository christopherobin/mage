var mithril = require('../../mithril'),
    async   = require('async'),
	uuid    = require('node-uuid');


exports.getManageCommands = function () {
	return ['createShop', 'editShop', 'deleteShop', 'getShops', 'createItem', 'editItem', 'deleteItem', 'createItemObject', 'createItemObjects', 'editItemObject', 'deleteItemObject', 'deleteItemObjects'];
};

// flatten/unflatten properties (what property map used to do)

function flattenProperties(data) {
	var properties = [];

	for (var prop in data) {
		var value = data[prop];
		var result = { property: prop, type: typeof value };

		switch (result.type) {
		case 'object':
			if (typeof value.getRaw === 'function') {
				value = value.getRaw();
			}

			if (value.lang) {
				result.type  = 'string';
				result.lang  = value.lang;
				result.value = value.val;
			} else {
				result.value = JSON.stringify(value);
			}

			break;

		case 'boolean':
			result.value = value ? '1' : '0';
			break;

		default:
			result.value = value;
			break;
		}

		properties.push(result);
	}

	return properties;
}


function unflattenProperties(data) {
	var properties = {};
	for (var i = 0, len = data.length; i < len; i++) {
		var propName = data[i].property;
		properties[propName] = {};

		switch (data[i].type) {
		case 'string':
			properties[propName] = data[i].value;
			break;

		case 'number':
			properties[propName] = parseInt(data[i].value, 10);
			break;

		case 'bool':
			properties[propName] = (data[i].value === 'true');
			break;

		case 'object':
			try {
				properties[propName] = JSON.parse(data[i].value);
			} catch (e) {
				mithril.core.logger.error('Could not JSON.parse data : ', data[i], ' -- error : ', e);
			}
			break;

		default:
			break;
		}
	}

	return properties;
}


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

	var sql = 'SELECT id, identifier, type FROM shop';
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

		if (shops.length === 0) {
			return cb(null, []);
		}

		if (options.propertyOptions) {
			var shopIds = [];

			for (var i = 0, len = shops.length; i < len; i++) {
				shopIds.push(shops[i].id);
			}

			if (shops.length > 0) {

				var shopSql = 'SELECT shopId, property, language, type, value FROM shop_data';
				state.datasources.db.getMany(shopSql, [], null, function (error, results) {
					var dataSet = {};
					for (var i = 0, len = results.length; i < len; i++) {
						var tempId = results[i].shopId;
						if (!dataSet[tempId]) {
							dataSet[tempId] = [];
						}

						dataSet[tempId].push(results[i]);
					}

					for (var i = 0, len = shops.length; i < len; i++) {
						shops[i].data = unflattenProperties(dataSet[shops[i].id]);
					}

					cb(null, shops);
				});
			} else {
				cb(null, shops);
			}
		} else {
			cb(null, shops);
		}
	});
};


exports.getShopById = function (state, id, cb) {
	var sql = 'SELECT id, identifier, type FROM shop WHERE id = ?';
	var params = [id];

	state.datasources.db.getOne(sql, params, true, null, cb);
};


exports.getShopByIdentifier = function (state, identifier, cb) {
	var sql = 'SELECT id, identifier, type FROM shop WHERE identifier = ?';
	var params = [identifier];

	state.datasources.db.getOne(sql, params, true, null, cb);
};


exports.getShopsByContainedItem = function (state, itemId, cb) {
	var sql = 'SELECT s.id, s.identifier, s.type FROM shop AS s JOIN shop_item_shop AS sis ON sis.shopId = s.id AND sis.itemId = ? ORDER BY sis.sortIndex ASC';
	var params = [itemId];

	state.datasources.db.getMany(sql, params, null, cb);
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


exports.getItems = function (state, itemIds, shopNames, cb) {
	// if no itemIds given, all items will be returned, if no shopName given, all will return

	var db = state.datasources.db;

	var sql = 'SELECT DISTINCT i.id' + (shopNames ? ', s.identifier AS shopIdentifier' : '') + ', i.identifier, i.status, i.currencyId, i.unitPrice, c.identifier AS currencyIdentifier FROM shop_currency AS c JOIN shop_item AS i ON i.currencyId = c.id';
	var params = [];
	var where = [];

	if (shopNames) {
		sql += ' JOIN shop_item_shop AS sis ON sis.itemId = i.id JOIN shop AS s ON s.id = sis.shopId';
		where.push('s.identifier IN (' + db.getPlaceHolders(shopNames.length) + ')');
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

				async.forEachSeries(objects, function (obj, objCb) {
					var itemId = obj.itemId;
					delete obj.itemId;

					exports.getShopItemObjectProperties(state, obj.id, null, function (error, results) {
						if (error) {
							return objCb(error);
						}

						obj.data = unflattenProperties(results);
						result[itemId].objects.push(obj);
						itemObjectIds.push(obj.id);
						objCb();
					});
				}, function (error) {
					if (error) {
						return cb(error);
					}

					cb(null, result);
				});
			});
		});
	});
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
			var clearSql  = 'DELETE FROM shop_item_data WHERE itemId = ?';
			var addSql    = 'INSERT INTO shop_item_data (itemId, property, language, type, value) VALUES (?, ?, ?, ?, ?)';
			var paramData = flattenProperties(data);


			async.series([
				function (dataCb) {
					state.datasources.db.exec(clearSql, [itemId], null, dataCb);
				},
				function (dataCb) {
					async.forEachSeries(paramData, function (property, propCb) {
						var addParams = [itemId, property.property, (property.language || ''), property.type, property.value];
						state.datasources.db.exec(addSql, addParams, null, propCb);
					}, dataCb);
				}
			], function (error) {
				if (error) {
					return callback(error);
				}

				callback(null, id);
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



