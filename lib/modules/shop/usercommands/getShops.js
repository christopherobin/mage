var mithril = require('../../../mithril');
var async   = require('async');

exports.params = ['types'];

exports.execute = function (state, types, cb) {
	var response  = {};

	mithril.shop.getShops(state, null, function (err, shops) {
		async.forEachSeries(shops, function (shop, callback) {
			var inShop = shop;

			if (inShop) {
				var outShop = {};
				for (var key in inShop) {
					if (key === 'data') {
						outShop.data = inShop.data.getAll(state.language(), null, null);
					} else {
						outShop[key] = inShop[key];
					}
				}

				mithril.shop.getItems(state, null, inShop.identifier, function (error, items) {
					if (error) {
						return callback(error);
					}

					if ((Object.keys(items).length > 0)) {
						outShop.items = {};

						for (var id in items) {
							var item = items[id];
							var outItem = {};
							for (var key in item) {
								switch (key) {
								case 'data':
									outItem.data = item.data.getAll(state.language(), null, null);
									break;
								case 'objects':
									var outObjs = [];
									var objects = item[key];
									for (var okey in objects) {
										var obj = objects[okey];
										var outObj = {};

										for (var oProp in obj) {
											if (oProp === 'data') {
												outObj.data = obj.data.getAll(state.language(), null, null);
											} else {
												outObj[oProp] = obj[oProp];
											}
										}

										outObjs.push(outObj);
									}

									outItem[key] = outObjs;
									break;

								default:
									outItem[key] = item[key];
									break;
								}
							}

							outShop.items[id] = outItem;
						}
					}

					response[outShop.identifier] = outShop;
					callback();
				});
			} else {
				callback();
			}
		}, function (error) {
			if (error) {
				return cb(error);
			}

			state.respond(response);
			cb();
		});
	});
};
