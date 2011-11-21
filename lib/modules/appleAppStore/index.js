var mithril = require('../../mithril'),
    common = require('./common'),
    async = require('async'),
    http;


var cfg;


// the callback that is triggered by the shop, when a payment process is tried, to make sure we have enough currency:

function onPaymentValidate(state, totalPrice, cb) {
	// There is no payment limit or even price on the product.

	cb();
}


// the callback that is triggered by the shop, when a payment process starts:

function onPaymentStart(state, purchaseRequest, cb) {
	cb(null, purchaseRequest);
}


exports.setup = function (state, cb) {
	cfg = mithril.getConfig('module.appleAppStore');

	switch (cfg.endpoint.protocol) {
	case 'http':
		http = require('http');
		break;
	case 'https':
		http = require('https');
		break;
	}

	// required cfg properties:
	//   bundleId: the application's ID on the app store (to verify the receipt is actually for this application)
	//   endpoint: { protocol: "http", host: "", path: "" } where path is the base path, probably empty.

	if (!cfg) {
		mithril.core.logger.error('appleAppStore module has no configuration');
		return cb(true);
	}

	if (mithril.shop) {
		mithril.shop.enforceCurrency(state, 'apple', { validate: onPaymentValidate, start: onPaymentStart }, cb);
	} else {
		cb();
	}
};

/*
CREATE TABLE `apple_appstore_payment` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT ,
  `actorId` INT UNSIGNED NOT NULL ,
  `shopPurchaseId` INT UNSIGNED ,
  `appleTransactionId` VARCHAR(100) NOT NULL ,
  `appleProductId` VARCHAR(100) NOT NULL ,
  `status` ENUM('paid','handled') NOT NULL ,
  `receipt` MEDIUMTEXT NOT NULL ,
  PRIMARY KEY (`id`) ,
  INDEX `keyAppleTransactionId` (`appleTransactionId` ASC) ,
  INDEX `fk_apple_appstore_payment_shopPurchaseId` (`shopPurchaseId` ASC) ,
  INDEX `fk_apple_appstore_payment_actorId` (`actorId` ASC) ,
  CONSTRAINT `fk_apple_appstore_payment_shopPurchaseId` FOREIGN KEY (`shopPurchaseId` ) REFERENCES `shop_purchase` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_apple_appstore_payment_actorId`FOREIGN KEY (`actorId` ) REFERENCES `actor` (`id` ) ON DELETE CASCADE ON UPDATE CASCADE)
ENGINE = InnoDB;
*/


exports.findPaymentByTransactionId = function (state, transactionId, cb) {
	var sql = 'SELECT id, shopPurchaseId, appleProductId, status FROM apple_appstore_payment WHERE actorId = ? AND appleTransactionId = ?';
	var params = [state.actorId, transactionId];

	state.datasources.db.getOne(sql, params, false, null, function (error, row) {
		if (error) {
			return cb(error);
		}

		cb(null, row);
	});
};


function createPayment(state, receipt, status, shopPurchaseId, cb) {
	// returns the payment record (id, shopPurchaseId, status) in the callback

	var sql = 'INSERT INTO apple_appstore_payment VALUES (NULL, ?, ?, ?, ?, ?, ?)';
	var params = [state.actorId, shopPurchaseId, receipt.transaction_id, receipt.product_id, status, JSON.stringify(receipt)];

	state.datasources.db.exec(sql, params, null, function (error, info) {
		if (error) {
			cb(error);
		} else {
			var payment = {
				id: info.insertId,
				shopPurchaseId: shopPurchaseId,
				appleProductId: receipt.product_id,
				status: status
			};

			cb(null, payment);
		}
	});
}


function updatePayment(state, id, status, purchaseId, cb) {
	var sql = 'UPDATE apple_appstore_payment SET status = ?, shopPurchaseId = ? WHERE id = ?';
	var params = [status, purchaseId, id];

	state.datasources.db.exec(sql, params, null, function (error) {
		cb(error);
	});
}


exports.purchaseWithReceipt = function (state, forActorId, receiptData, cb) {

	// decode the receipt data

	var receipt, paymentInfo, shopPurchase, purchaseResponse;

	async.waterfall([
		function (callback) {
			mithril.core.logger.debug('verifying receipt');

			exports.rest.send('POST', '/verifyReceipt', {}, { 'receipt-data': receiptData }, callback);
		},
		function (statusCode, response, callback) {
			// checkpoint: we have successfully decoded the receipt

			receipt = response.receipt;

			// make sure the receipt is for this application

			if (receipt.bid !== cfg.bundleId) {
				return state.error('invalidReceipt', 'Payment attempt with a receipt for a different bundle ID: ' + receipt.bid, callback);
			}

			// fetch the existing appstore_payment record, if it exists
			// if it already exists, and has not been handled, we'll handle it now

			mithril.core.logger.debug('searching for payment by transaction ID');

			exports.findPaymentByTransactionId(state, receipt.transaction_id, callback);
		},
		function (payment, callback) {
			// if there is a payment record, and the payment has already been handled,
			// there is nothing to do, and we can abort the entire operation.

			// if the payment record exists, but hasn't yet been handled, let's handle it now.

			if (payment) {
				if (payment.status === 'handled') {
					mithril.core.logger.debug('already handled');

					cb(null, { status: 'alreadyHandled' });
				} else {
					mithril.core.logger.debug('paid payment exists, but not handled');

					callback(null, payment);
				}
			} else {
				// there is no payment record yet (the normal case), so we create one
				// createPayment() returns the payment record (id, shopPurchaseId, status) in the callback

				mithril.core.logger.debug('creating payment');

				createPayment(state, receipt, 'paid', null, callback);
			}
		},
		function (payment, callback) {
			// based on payment.appleProductId, we have to find the item that fits it,
			// so we can trigger shop.startPurchase

			paymentInfo = payment;

			mithril.core.logger.debug('finding item with appleProductId :' + payment.appleProductId);

			mithril.shop.findItemIdWithProperty(state, 'appleProductId', payment.appleProductId, callback);
		},
		function (itemId, callback) {
			if (!itemId) {
				// big problem!
				// the user paid for a product we no longer offer

				return state.error(null, 'Actor ' + state.actorId + ' paid for appleProductId "' + paymentInfo.appleProductId + '", but it is not on offer.', callback);
			}

			// find the shops that this item is part of

			mithril.core.logger.debug('finding shop by contained item: ' + itemId);

			mithril.shop.getShopsByContainedItem(state, itemId, function (error, shops) {
				if (error) {
					return callback(error);
				}

				if (!shops || shops.length === 0) {
					// this item is not part of a shop, should never happen

					return state.error(null, 'Actor ' + state.actorId + ' paid for appleProductId "' + paymentInfo.appleProductId + '", but it is not in a shop.', callback);
				}

				callback(null, itemId, shops[0].identifier);
			});
		},
		function (itemId, shopName, callback) {
			var items = {};
			items[itemId] = Math.max(1, ~~receipt.quantity);

			// the startPurchase() call will respond with the purchaseRequest object

			mithril.core.logger.debug('starting the shop purchase');

			mithril.shop.startPurchase(state, forActorId, shopName, items, function (error, purchaseRequest) {
				if (error) {
					return callback(error);
				}

				shopPurchase = purchaseRequest;
				callback();
			});
		},
		function (callback) {
			// the purchase process has started, we can instantly:
			// - update our appstore payment record to "handled" and store the link to the shop_purchase record

			mithril.core.logger.debug('setting payment to "handled"');

			updatePayment(state, paymentInfo.id, 'handled', shopPurchase.id, callback);
		},
		function (callback) {
			// the purchase process has started, we can instantly:
			// - confirm to the shop that the purchase has been paid for

			mithril.core.logger.debug('starting shop purchase paid trigger');

			mithril.shop.purchasePaid(state, shopPurchase.id, function (error, lastPurchase) {
				if (error) {
					return callback(error);
				}

				purchaseResponse = lastPurchase;

				callback();
			});
		}
	],
	function (error) {
		if (error) {
			cb(error);
		} else {
			cb(null, purchaseResponse);
		}
	});
};


// communicating with Apple

exports.rest = {};

exports.rest.send = function (httpMethod, path, getParams, postData, cb) {
	path = cfg.endpoint.path + (cfg.endpoint.path[cfg.endpoint.path.length - 1] === '/' ? '' : '/') + (path[0] === '/' ? path.substring(1) : path);

	if (getParams) {
		// add GET parameters to URL

		var qs = [];

		for (var param in getParams) {
			qs.push(param + '=' + common.encodeRfc3986(getParams[param]));
		}

		if (qs.length > 0) {
			path += '?' + qs.join('&');
		}
	}

	var headers = {
	};

	if (postData) {
		headers['Content-Type'] = 'application/json; charset=utf-8';
		postData = JSON.stringify(postData);
	}

	var options = {
		method: httpMethod,
		host: cfg.endpoint.host,
		port: cfg.endpoint.port,
		path: path,
		headers: headers
	};

	mithril.core.logger.debug('Apple: Q', options);

	var request = http.request(options, function (response) {
		// deal with HTTP response

		var statusCode = response.statusCode;

		if (~~(statusCode / 100) !== 2) {
			mithril.core.logger.debug('Apple: A', statusCode);

			return cb(statusCode);
		}

		response.setEncoding('utf8');

		var data = '';

		response.on('data', function (chunk) {
			data += chunk;
		});

		response.on('end', function () {
			try {
				data = JSON.parse(data);
			} catch (e) {
				data = false;
			}

			mithril.core.logger.debug('Apple: A', data);

			cb(null, statusCode, data);
		});
	});

	// send

	if (postData) {
		request.end(postData);
	} else {
		request.end();
	}
};

