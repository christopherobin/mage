var mithril = require('../../mithril'),
    logger = mithril.core.logger,
	crypto = require('crypto'),
	OAuth = require('oauth').OAuth,
	querystring = require('querystring');

// Constants
var GREE_GADGET_HANDLER_ROUTE = '/gree/gadget.xml',
	GREE_LIFE_CYCLE_EVENTS_HANDLER_ROUTE = '/gree/callback',
	GREE_PURCHASE_VERIFICATION_HANDLER_ROUTE = '/gree/iap';

/**
 * OAuth client.
 * Constant set in setup().
 *
 * @type {Oauth}
 * @private
 */
var OAUTH_CLIENT = null;

/**
 * Main GREE API entry point.
 * Constant set in setup().
 *
 * @type {String}
 * @private
 */
var GREE_ENDPOINT = null;

/**
 * GREE app id.
 * Constant set in setup().
 *
 * @type {String}
 * @private
 */
var GREE_APP_ID = null;

/**
 * Life cycle events handler URL.
 * Constant set in setup().
 *
 * @type {String}
 * @private
 */
var GREE_LIFE_CYCLE_EVENTS_HANDLER_URL = null;

/**
 * Application-set function that gets called upon user login.
 * Must have the signature function(state, actorId, userId, profile, cb).
 *
 * @type {?function(!mithril.core.State, !String, !String, !Object, !function(?Error))}
 * param {!mithril.core.State} state
 * param {!String}             actorId
 * param {!String}             userId
 * param {!Object}             profile
 * param {!function(?Error)}   cb
 */
exports.onLogin = null;

/**
 * Application-set function that gets called when there is no existing actor for
 * the specified GREE user id. It will either create a new actor or return an error.
 *
 * @type {?function(!mithril.core.State, !String, !Object, !function(?Error, ?String))}
 * param {!mithril.core.State}        state
 * param {!String}                    userId
 * param {!Object}                    profile
 * param {!function(?Error, ?String)} cb Callback. 2nd parameter is the new actor's id.
 */
exports.onNewPlayer = null;

/**
 * Application-set function that gets called to verify a GREE purchase. Purchase will
 * get rejected if this function produces a non-null error.
 *
 * @type {?function(!mithril.core.State, !String, !String, !Object, !function(?Error))}
 * param {!mithril.core.State} state
 * param {!String}             actorId
 * param {!String}             userId
 * param {!Object}             purchaseInfo
 * param {!function(?Error)}   cb
 */
exports.onVerifyPurchase = null;

/**
 * Application-set function that gets called upon purchase completion (from the completePurchase
 * user command). purchaseInfo has the following properties:
 *   - {String}                           paymentId
 *   - {String}                           platform (e.g. "ios")
 *   - {String}                           completionCode (either "complete", "canceled" or "expired")
 *   - {Date}                             orderedTime
 *   - {Date}                             executedTime
 *   - {Array.<PaymentItem>}              paymentItems
 *
 * @type {?function(!mithril.core.State, !String, !String, !Object, !String, !function(?Error))}
 * param {!mithril.core.State} state
 * param {!String}             actorId
 * param {!String}             userId
 * param {!Object}             purchaseInfo
 * param {!function(?Error)}   cb
 */
exports.onPurchaseCompletion = null;

/**
 * Application-set array of fields that should be retrieved when the module fetches the user's
 * profile.
 *
 * @type {!Array.<String>}
 * @see https://docs.developer.gree.net/en/globaltechnicalspecs/api/peopleapi#p2
 */
exports.profileFields = [];

/**
 * Application-set boolean that tells the module if payments use GREE coins or app-specific coins
 * (e.g. Apple appstore money).
 *
 * @type {Boolean}
 */
exports.useGreeCoins = false;

/**
 * Build a hash of all the arguments, coerced to strings
 *
 * @param {...String} var_args
 * @return {String}
 *
 * @private
 * @nosideeffects
 */
function buildHash() {
	return Array.prototype.reduce.call(
		arguments,
		function (previous, arg) {
			return previous.update(String(arg));
		},
		crypto.createHash('sha256')
	).digest('hex');
}

/**
 * Return a live property map of the specified user's GREE-specific properties.
 *
 * @param {!mithril.core.State}        state   Mithril state.
 * @param {!String}                    userId  GREE identifier for the user.
 * @param {?Object}                    options Options passed to mithril.core.LivePropertyMap.create().
 * @param {!function(?Error, ?Object)} cb      Callback.
 *
 * @private
 */
function getUserProperties(state, userId, options, cb) {
	var domain = {
		id: userId,
		key: 'gree/' + userId
	};

	mithril.core.LivePropertyMap.create(state, domain, options, cb);
}

/**
 * Send a HTTP response.
 *
 * @param {!mithril.core.State} state   Mithril state.
 * @param {!Number}             status  HTTP status code.
 * @param {!String}             message Message.
 * @param {?Object=}            headers HTTP headers.
 * @param {!function}           cb      HTTP handler's callback.
 *
 * @private
 */
function sendHttpResponse(state, status, message, headers, cb) {
	if (typeof headers === 'function' && cb === undefined) {
		cb = headers;
		headers = {};
	}

	if (status >= 400) {
		logger.error('[GREE] returning', status, '(' + message + ') to caller');
	}

	if (state) {
		state.close();
	}

	cb(status, message, headers);
}

/**
 * Send a 400 Invalid request HTTP response.
 *
 * @param {!mithril.core.State} state   Mithril state.
 * @param {!function}           cb      HTTP handler's callback.
 *
 * @private
 */
function sendHttpInvalidRequestError(state, cb) {
	return sendHttpResponse(state, 400, 'Invalid request', cb);
}

/**
 * Send a 401 Unauthorized HTTP response.
 *
 * @param {!mithril.core.State} state   Mithril state.
 * @param {!function}           cb      HTTP handler's callback.
 *
 * @private
 */
function sendHttpUnauthorizedError(state, cb) {
	return sendHttpResponse(state, 401, 'Unauthorized', cb);
}

/**
 * Send a 403 Forbidden HTTP response.
 *
 * @param {!mithril.core.State} state   Mithril state.
 * @param {!function}           cb      HTTP handler's callback.
 *
 * @private
 */
function sendHttpForbiddenError(state, cb) {
	return sendHttpResponse(state, 403, 'Forbidden', cb);
}

/**
 * Send a 404 Not found HTTP response.
 *
 * @param {!mithril.core.State} state   Mithril state.
 * @param {!function}           cb      HTTP handler's callback.
 *
 * @private
 */
function sendHttpNotFoundError(state, cb) {
	return sendHttpResponse(state, 404, 'Not found', cb);
}

/**
 * HTTP request handler function that serves our game's gadget.xml file to GREE.
 *
 * @param {!http.ServerRequest} request
 * @param {!String}             path
 * @param {?Object}             params
 * @param {!function}           cb
 *
 * @private
 */
function handleGadgetRequest(request, path, params, cb) {
	var appId = params && params.opensocial_app_id,
		xml = [
			'<?xml version="1.0" encoding="UTF-8"?>',
			'<Module>',
			'<ModulePrefs>',
			'<Link rel="event.addapp" href="'         + GREE_LIFE_CYCLE_EVENTS_HANDLER_URL + '" method="GET" />',
			'<Link rel="event.suspendapp" href="'     + GREE_LIFE_CYCLE_EVENTS_HANDLER_URL + '" method="GET" />',
			'<Link rel="event.resumeapp" href="'      + GREE_LIFE_CYCLE_EVENTS_HANDLER_URL + '" method="GET" />',
			'<Link rel="event.upgradeuser" href="'    + GREE_LIFE_CYCLE_EVENTS_HANDLER_URL + '" method="GET" />',
			'<Link rel="event.removeapp" href="'      + GREE_LIFE_CYCLE_EVENTS_HANDLER_URL + '" method="GET" />',
			'<Link rel="gree.join_community" href="'  + GREE_LIFE_CYCLE_EVENTS_HANDLER_URL + '" method="GET" />',
			'<Link rel="gree.leave_community" href="' + GREE_LIFE_CYCLE_EVENTS_HANDLER_URL + '" method="GET" />',
			'</ModulePrefs>',
			'<Content view="touch" type="url" href="about:blank"/>',
			'</Module>'
		].join('\n');

	if (GREE_APP_ID === appId) {
		sendHttpResponse(null, 200, xml, { 'Content-Type': 'application/xml' }, cb);
	} else {
		logger.error('[GREE] Got a gadget.xml request for an unknown application, id:', appId);
		sendHttpNotFoundError(null, cb);
	}
}

/**
 * Retrieve user's profile.
 * Will only request the fields specified in exports.profileFields.
 *
 * @param {!mithril.core.State}        state
 * @param {!String}                    token
 * @param {!String}                    tokenSecret
 * @param {!function(?Error, ?Object)} cb
 *
 * @private
 */
function retrieveUserProfile(state, token, tokenSecret, cb) {
	var fields = exports.profileFields,
		params = '';

	if (fields instanceof Array && fields.length > 0) {
		params = '?' + querystring.stringify({fields: fields.join(',')});
	}

	OAUTH_CLIENT.get(GREE_ENDPOINT + '/people/@me/@self' + params, token, tokenSecret, function (error, data, response) {
		if (error) {
			return state.error(null, 'Couldn\'t retrieve GREE user profile: ' + JSON.stringify(error), cb);
		}

		try {
			data = JSON.parse(data);
		} catch (e) {
			return state.error(null, 'Failed to parse user profile: ' + JSON.stringify(error), cb);
		}

		if (!data.entry) {
            return state.error(null, 'Malformed response received for user profile: ' + JSON.stringify(data), cb);
        }

		return cb(null, data.entry);
	});
}

/**
 * Retrieve a payment's information.
 *
 * Callback will receive a Payment object with the following properties:
 *   - {String}              paymentId
 *   - {String}              platform (e.g. "ios")
 *   - {String}              status (actually a number in [1-4] range
 *   - {Array.<PaymentItem>} paymentItems
 *   - {String}              message (as set by the client)
 *   - {String}              orderedTime
 *   - {String=}             executedTime (only when the purchase has been complete)
 *
 * PaymentItem objects have the following properties:
 *   - {String} itemId
 *   - {String} itemName
 *   - {String} unitPrice (actually a number)
 *   - {String} quantity (actualy a number)
 *   - {String} imageUrl
 *   - {String} description
 *
 *
 * @param {!mithril.core.State}        state
 * @param {!String}                    userId
 * @param {!String}                    paymentId
 * @param {!function(?Error, ?Object)} cb
 *
 * @private
 */
function retrievePaymentInfo(state, userId, paymentId, cb) {
	var paymentInfoUrl = [
		GREE_ENDPOINT,
		exports.useGreeCoins ? '':'/local',
		'/payment/',
		userId,
		'/@self/@app/',
		paymentId,
		'?platform=ios'
	].join('');

	// Make a "batch" request to GREE servers (no token, no tokenSecret)
	OAUTH_CLIENT.get(paymentInfoUrl, null, null, function (error, data, response) {
		if (error) {
			return state.error(null, 'Couldn\'t retrieve payment info for user ' + userId + '\'s payment ' + paymentId + ': ' + JSON.stringify(error), cb);
		}

		logger.debug('[GREE] Retrieved payment information:', data);

		try {
			data = JSON.parse(data);
		} catch (e) {
			return state.error(null, 'Failed to parse payment info for user ' + userId + '\'s payment ' + paymentId + ': ' + JSON.stringify(error), cb);
		}

		if (!data.entry) {
			return state.error(null, 'Malformed response received for user ' + userId + '\'s payment ' + paymentId + ': ' + JSON.stringify(data), cb);
		}

		cb(null, data.entry);
	});
}

/**
 * This function is called by the getSessionInsecure user command, as well as
 * by external providers (e.g. Giraffe).
 *
 * @param {!mithril.core.State} state
 * @param {!String}             userId
 * @param {!String}             token
 * @param {!String}             tokenSecret
 * @param {!function(?Error)}   cb
 */
exports.didLogin = function (state, userId, token, tokenSecret, cb) {
	if (!userId || !token || !tokenSecret) {
		return state.error(null, 'Missing parameters', cb);
	}

	logger.info('Gree user login attempt:', userId);

	getUserProperties(state, userId, { optional: ['actorId'] }, function (error, props) {
		if (error) {
			return cb(error);
		}

		var actorId = props.get('actorId');

		// update tokens if needed
		props.set('token', token);
		props.set('tokenSecret', tokenSecret);

		if (actorId) {
			// user already exists
			return cb();
		}

		// Got a new player
		retrieveUserProfile(state, token, tokenSecret, function (error, profile) {
			if (error) {
				return cb(error);
			}

			if (typeof exports.onNewPlayer !== 'function') {
				return state.error(null, 'mithril.gree.onNewPlayer is not defined', cb);
			}

			exports.onNewPlayer(state, userId, profile, function (error, actorId) {
				if (error) {
					return cb(error);
				}

				props.set('actorId', actorId);

				// Store the user ID on the actor property map
				mithril.actor.getActorProperties(state, actorId, {}, function (error, actorProps) {
					if (error) {
						return cb(error);
					}

					actorProps.set('greeUserId', userId);

					cb();
				});
			});
		});
	});
};


function handleLifeCycleEventNotificationRequest(request, path, params, cb) {
	// TODO: we don't handle lifecycle events right now
	logger.debug('GREE lifecycle event. HTTP headers:', request.headers, 'params:', params);

	sendHttpResponse(null, 200, 'OK', cb);
}


function handleInAppPurchaseVerificationRequest(request, path, params, cb) {
	logger.debug('[GREE] Received IAP verification request:', params);

	if (GREE_APP_ID !== params.opensocial_app_id) {
		return sendHttpForbiddenError(null, cb);
	}

	if (!params.opensocial_viewer_id || !params.paymentId || params.status !== '2') {
		return sendHttpInvalidRequestError(null, cb);
	}

	var state = new mithril.core.State();
	var userId    = String(params.opensocial_viewer_id),
		paymentId = String(params.paymentId);

	getUserProperties(state, userId, { load: ['actorId'] }, function (error, props) {
		var actorId = props && props.get('actorId');

		if (error || !actorId) {
			return sendHttpUnauthorizedError(state, cb);
		}

		function verifyPurchase() {
			logger.debug('[GREE] Payment', paymentId, 'accepted for user with GREE id:', userId);
			return sendHttpResponse(state, 200, 'OK', cb);
		}

		if (typeof exports.onVerifyPurchase === 'function') {
			// retrieve the payment info from gree, to pass to onVerifyPurchase()

			retrievePaymentInfo(state, userId, paymentId, function (error, data) {
				if (error) {
					return sendHttpResponse(state, 500, 'Couldn\'t retrieve payment info', cb);
				}

				exports.onVerifyPurchase(state, actorId, userId, data, function (error) {
					if (error) {
						// Reject the transaction
						logger.error('[GREE] Payment', paymentId, 'refused for user with GREE id:', userId);
						return sendHttpForbiddenError(state, cb);
					}

					verifyPurchase();
				});
			});
		} else {
			verifyPurchase();
		}
	});
}


var config;

exports.setup = function (state, cb) {
	// read which environment should be used

	var env = mithril.core.config.get('module.gree.env');
	if (typeof env !== 'string') {
		return state.error(null, 'No environment selected for GREE', cb);
	}

	logger.debug('GREE using environment', env);

	// get the configuration out for the selected environment

	config = mithril.core.config.get('module.gree.environments.' + env);
	if (!config) {
		return state.error(null, 'GREE environment missing: ' + env, cb);
	}

	// set up OAuth

	var consumer = config.consumer;
	if (!config.consumer || !consumer.key || !consumer.secret) {
		return state.error(null, 'gree module needs module.gree.consumer.{key,secret} configuration entries', cb);
	}

	OAUTH_CLIENT = new OAuth('', '', consumer.key, consumer.secret, '1.0', null, 'HMAC-SHA1');

	// set up main GREE API endpoint (http://os-sb.gree.net/api/rest or http://os.gree.net/api/rest)
	GREE_ENDPOINT = config.endpoint;

	if (typeof GREE_ENDPOINT !== 'string') {
		return state.error(null, 'GREE API endpoint not defined', cb);
	}

	logger.debug('GREE API endpoint', GREE_ENDPOINT);

	// set up app ID

	if (!config.appId) {
		return state.error(null, 'GREE app ID not defined', cb);
	}

	GREE_APP_ID = String(config.appId);

	logger.debug('GREE App ID', GREE_APP_ID);


	// set up lifecycle events URL

	var clientHost = mithril.core.config.get('server.clientHost', {});
	var expose = clientHost.expose;

	if (!expose) {
		return state.error(null, 'Could not find clientHost configuration', cb);
	}

	GREE_LIFE_CYCLE_EVENTS_HANDLER_URL = (clientHost.protocol || 'http') + '://' + expose.host + ':' + (expose.port || '80') + GREE_LIFE_CYCLE_EVENTS_HANDLER_ROUTE;

	// set up HTTP routes
	var httpServer = mithril.core.msgServer.getHttpServer();
	if (!httpServer) {
		return state.error(null, 'No HTTP server available', cb);
	}

	httpServer.addRoute(GREE_GADGET_HANDLER_ROUTE,                handleGadgetRequest);
	httpServer.addRoute(GREE_PURCHASE_VERIFICATION_HANDLER_ROUTE, handleInAppPurchaseVerificationRequest);
	httpServer.addRoute(GREE_LIFE_CYCLE_EVENTS_HANDLER_ROUTE,     handleLifeCycleEventNotificationRequest);

	cb();
};

/**
 * Retrieve a session for a currently logged in user.
 *
 * @param {!mithril.core.State}        state
 * @param {!String}                    userId
 * @param {!String}                    nonce
 * @param {!String}                    timestamp
 * @param {!String}                    hash
 * @param {!function(?Error, ?String)} cb
 *
 * @note Implementation of the getSession() user command.
 */
exports.getSession = function (state, userId, nonce, timestamp, hash, cb) {
	if (!userId || !nonce || !timestamp || !hash) {
		return state.error('auth', 'Parameter is missing in gree.getSession()', cb);
	}

	getUserProperties(state, userId, { load: ['actorId', 'token', 'tokenSecret'] }, function (error, props) {
		if (error) {
			return cb(error);
		}

		var actorId = props.get('actorId');
		if (!actorId) {
			return state.error('auth', 'Gree user ' + userId + ' has no associated actor id', cb);
		}

		var token = props.get('token'),
			tokenSecret = props.get('tokenSecret');

		// verify hash
		if (hash !== buildHash(tokenSecret, nonce, timestamp, userId)) {
			return state.error('auth', 'Gree hash is not valid', cb);
		}

		// retrieve user profile from GREE.
		retrieveUserProfile(state, token, tokenSecret, function (error, profile) {
			if (error) {
				return cb(error);
			}

			// register the session
			mithril.session.register(state, actorId, function (error, session) {
				if (error) {
					return cb(error);
				}

				if (typeof exports.onLogin === 'function') {
					return exports.onLogin(state, actorId, userId, profile, function (error) {
						if (error) {
							return cb(error);
						}

						cb(null, session.getFullKey(), { 'content-type': 'application/json; charset=utf-8' });
					});
				}

				cb(null, session.getFullKey(), { 'content-type': 'application/json; charset=utf-8' });
			});
		});
	});
};

/**
 * Check if a purchase has been completed and notifies the game if so. Callback's second
 * parameter is either null or an object with the following properties:
 *   - {!String} completionCode: same values as those accepted by onPurchaseCompletion()
 *   - {!Object} purchaseInfo:   structure returned by GREE containing the purchase info.
 *
 * @param {!mithril.core.State}        state
 * @param {!String}                    userId
 * @param {!String}                    paymendId
 * @param {!String}                    nonce
 * @param {!String}                    timestamp
 * @param {!String}                    hash
 * @param {!function(?Error, ?Object)} cb
 *
 * @note Implementation of the completePurchase() user command.
 */
exports.completePurchase = function (state, userId, paymentId, nonce, timestamp, hash, cb) {
	if (!paymentId) {
		return state.error(null, 'No payment ID given in gree.completePurchase()', cb);
	}

	if (!userId || !nonce || !timestamp || !hash) {
		return state.error('auth', 'Parameter is missing in gree.completePurchase()', cb);
	}

	getUserProperties(state, userId, { load: ['actorId', 'tokenSecret'] }, function (error, props) {
		if (error) {
			return cb(error);
		}

		var actorId = props.get('actorId');
		if (!actorId) {
			return state.error('auth', 'Gree user has no associated actor id', cb);
		}

		// verify hash
		var tokenSecret = props.get('tokenSecret');
		if (hash !== buildHash(tokenSecret, nonce, timestamp, userId, paymentId)) {
			return state.error('auth', 'Gree hash is not valid', cb);
		}

		// get payment information from gree
		retrievePaymentInfo(state, userId, paymentId, function (error, data) {
			if (error) {
				return cb(error);
			}

			if (!data) {
				return state.error(null, 'Gree did not return any payment information', cb);
			}

			var completionCodes = {
				// see https://docs.developer.gree.net/en/globaltechnicalspecs/api/payment-api
				2: 'complete',
				3: 'canceled',
				4: 'expired'
			};

			var completionCode = completionCodes[data.status];

			if (!completionCode) {
				return state.error(null, "Purchase hasn't been completed yet", cb);
			}

			if (completionCode === 'complete' && !exports.onPurchaseCompletion) {
				return state.error(null, 'Purchase completed, but no gree.onPurchaseCompletion method has been registered!', cb);
			}

			// Remove useless information such as description or image url from items
			// before saving the transaction to database. Keep only the quantity,
			// current price and item id.

			var boughtItems = '';

			if (data.paymentItems) {
				boughtItems = data.paymentItems.map(function (item) {
					return {
						quantity:  item.quantity,
						unitPrice: item.unitPrice,
						itemId:    item.itemId
					};
				});
			}

			// According to https://docs.developer.gree.net/en/globaltechnicalspecs/api/payment-api,
			// "orderedTime will always return standard world time, unrelated to local time zones"

			var orderedTime = 0, executedTime = 0;

			if (data.orderedTime) {
				orderedTime = Math.round((new Date(data.orderedTime + ' GMT')).getTime() / 1000);
			}

			if (data.executedTime) {
				executedTime = Math.round((new Date(data.executedTime + ' GMT')).getTime() / 1000);
			}

			var purchase = {
				paymentId:        data.paymentId,
				platform:         data.platform,
				completionStatus: data.status,
				completionCode:   completionCode,
				orderedTime:      orderedTime,
				executedTime:     executedTime,
				paymentItems:     data.paymentItems
			};

			// Store completed payments in database. paymentId is the primary key.
			// If the purchase record already exists, this will not insert anything, and onPurchaseCompletion will not run.

			var sql = 'INSERT IGNORE INTO gree_purchases VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
			var params = [data.paymentId, actorId, data.platform, completionCode, orderedTime, executedTime, JSON.stringify(boughtItems), data.message || ''];

			state.datasources.db.exec(sql, params, null, function (error, info) {
				if (error) {
					return cb(error);
				}

				if (info.affectedRows < 1) {
					logger.info('[GREE] Player tried to complete an already completed purchase:', purchase);

					return cb(null, purchase);
				}


				if (completionCode !== 'complete') {
					logger.info('[GREE] Purchase handled, but not completed:', completionCode);

					return cb(null, purchase);
				}

				exports.onPurchaseCompletion(state, actorId, userId, purchase, function (error) {
					if (error) {
						return cb(error);
					}

					cb(null, purchase);
				});
			});
		});
	});
};

