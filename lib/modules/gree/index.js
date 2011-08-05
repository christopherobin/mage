var mithril = require('../../mithril'),
    crypto = require('crypto'),
    http = require('http');


exports.userCommands = {
	getFriends: __dirname + '/usercommands/getFriends.js',
	getUserIds: __dirname + '/usercommands/getUserIds.js'
};


var users = {};
var oauth = null;
var apiPaths = {};


exports.onNewUser = null;	// function(state, user, cb) { ... }		-> cb(null, playerId);					or cb(error);
exports.onLogin = null;		// function(state, playerId, isNewPlayer, cb) { ... }	-> cb(null, redirectUrl, 'Welcome!');	or cb(error);
exports.onLoginFail = null;	// function(cb) { ... }						-> cb('Sorry');


const PAYMENT_NEW = 1;
const PAYMENT_PAID = 2;
const PAYMENT_CANCELLED = 3;
const PAYMENT_EXPIRED = 4;


exports.hooks = {
	getAuthenticationFailedMessage: function() { return 'Authentication failed.'; },
	getLoginFailedMessage:          function() { return 'Login failed.'; }
};


exports.setup = function(state, cb)
{
	var cfg = mithril.core.config.module.gree;

	for (var api in cfg.expose)
	{
		var path = cfg.expose[api];
		if (path[0] != '/') path = '/' + path;

		apiPaths[api] = path;

		mithril.addRoute(path, exports.handleHttpRequest);
	}

	oauth = new CustomOAuth(cfg.endpoint, cfg.appId, cfg.consumer);

	if (mithril.shop)
	{
		mithril.shop.enforceCurrency(state, 'greecoin', { validate: exports.paymentValidate, start: exports.paymentStart }, cb);
	}
	else
		cb();
};


exports.paymentValidate = function(state, totalPrice, cb)
{
	// We cannot guess the total available coin, so we allow any transaction

	cb();
};


exports.handleHttpRequest = function(request, path, params, cb)
{
	mithril.core.logger.info('GREE: received request: ' + path);

	switch (path)
	{
		case apiPaths.login:
			return exports.httpReqLogin(request, path, params, cb);

		case apiPaths.addApp:
			return exports.httpReqAddApp(request, path, params, cb);

		case apiPaths.suspendApp:
			return exports.httpReqSuspendApp(request, path, params, cb);

		case apiPaths.resumeApp:
			return exports.httpReqResumeApp(request, path, params, cb);

		case apiPaths.removeApp:
			return exports.httpReqRemoveApp(request, path, params, cb);

		case apiPaths.paymentConfirm:
			return exports.httpReqPaymentConfirm(request, path, params, cb);

		case apiPaths.gadget:
			return exports.httpReqGadgetXml(request, path, params, cb);
	}

	cb(false);
};


exports.httpReqGadgetXml = function(request, path, params, cb)
{
	var xml = exports.getGadgetXml();
	if (xml)
	{
		mithril.core.logger.info('Returning gadget XML to GREE request.');

		cb(200, xml, { 'Content-Type': 'application/xml' });
	}
	else
		cb(false);
};


exports.httpReqPaymentConfirm = function(request, path, params, cb)
{
	exports.paymentConfirm(request, path, params, function() { cb(200, 'OK'); });
};


exports.httpReqLogin = function(request, path, params, cb)
{
	var state = new mithril.core.State;

	exports.tryAuthenticate(state, request, path, params, true, function(error, user, playerId) {
		if (error)
		{
			state.close();
			return cb(404, exports.hooks.getAuthenticationFailedMessage());
		}

		var onComplete = function(error, redirectUrl, data)
		{
			state.close();

			if (error) return cb(404, data || exports.hooks.getLoginFailedMessage());

			if (redirectUrl)
				cb(307, data || '', { 'Location': redirectUrl });
			else
				cb(200, data);
		};

		if (playerId)
		{
			exports.onLogin(state, playerId, onComplete);
		}
		else
		{
			exports.onNewPlayer(state, user, user.userId, function(error, newPlayerId) {
				if (error) return onComplete(error);

				exports.registerUser(state, user, newPlayerId, null, function(error) {
					if (error) return onComplete(error);

					exports.onLogin(state, newPlayerId, onComplete);
				});
			});
		}
	});
};


exports.httpReqAddApp = function(request, path, params, cb)
{
	// GREE requires us to do nothing more than register the invitation

	if (!params.invite_from_id)
	{
		return cb(200, 'OK');
	}

	var state = new mithril.core.State;

	exports.tryAuthenticate(state, request, path, params, false, function(error) {
		if (error || !params.id)
		{
			state.close();
			return cb(404, exports.hooks.getAuthenticationFailedMessage());
		}

		var onComplete = function(error)
		{
			state.close();

			if (error) return cb(404, 'error');
			cb(200, 'OK');
		};

		// store invitations

		var invitedByUserId = ~~params.invite_from_id;
		var userIds = params.id.split(',');

		var sql = 'INSERT INTO gree_invitation VALUES ';
		var params = [];
		var values = [];

		var len = userIds.length;
		for (var i=0; i < len; i++)
		{
			params.push(~~userIds[i], invitedByUserId);
			values.push('(?, ?)');
		}

		sql += values.join(', ');

		state.datasources.db.exec(sql, params, null, function(error) { onComplete(error); });
	});
};


exports.httpReqSuspendApp = function(request, path, params, cb)
{
	// This is not actually implemented or supported by GREE it seems.

	cb(200, 'OK');

/*
	var state = new mithril.core.State;

	exports.tryAuthenticate(state, request, path, params, true, function(error, user, playerId) {
		if (error)
		{
			state.close();
			return cb(404, exports.hooks.getAuthenticationFailedMessage());
		}

		var onComplete = function(error)
		{
			state.close();

			if (error) return cb(404, 'error');
			cb(200, 'OK');
		};

		exports.setStatus(state, playerId, 'suspended', onComplete);
	});
*/
};


exports.httpReqResumeApp = function(request, path, params, cb)
{
	// This is not actually implemented or supported by GREE it seems.

	cb(200, 'OK');

/*
	var state = new mithril.core.State;

	exports.tryAuthenticate(state, request, path, params, true, function(error, user, playerId) {
		if (error)
		{
			state.close();
			return cb(404, exports.hooks.getAuthenticationFailedMessage());
		}

		var onComplete = function(error)
		{
			state.close();

			if (error) return cb(404, 'error');
			cb(200, 'OK');
		};

		exports.setStatus(state, playerId, 'installed', onComplete);
	});
*/
};


exports.httpReqRemoveApp = function(request, path, params, cb)
{
	// This is not actually implemented or supported by GREE it seems.

	cb(200, 'OK');

/*
	var state = new mithril.core.State;

	exports.tryAuthenticate(state, request, path, params, true, function(error, user, playerId) {
		if (error)
		{
			state.close();
			return cb(404, exports.hooks.getAuthenticationFailedMessage());
		}

		var onComplete = function(error)
		{
			state.close();

			if (error) return cb(404, 'error');
			cb(200, 'OK');
		};

		exports.setStatus(state, playerId, 'uninstalled', onComplete);
	});
*/
};


exports.tryAuthenticate = function(state, request, path, params, resolvePlayer, cb)
{
	if (!oauth.isValidAppId(params.opensocial_app_id))
	{
		return state.error(null, 'Invalid App ID: ' + params.opensocial_app_id, cb);
	}

	if (!oauth.isValidSignature(request.method, 'http://' + request.headers.host + path, params, request.headers.authorization))
	{
		return state.error(null, 'Invalid signature: ' + JSON.stringify({ method: request.method, url: 'http://' + request.headers.host + path, params: params, auth: request.headers.authorization }), cb);
	}

	if (!resolvePlayer)
	{
		return cb();
	}

	if (!params.opensocial_viewer_id || !params.oauth_token || !params.oauth_token_secret)
	{
		return state.error(null, 'Tried to resolve player, but no user information was found in the GET parameters of this request.', cb);
	}

	var user = {
		userId: params.opensocial_viewer_id,
		token: params.oauth_token,
		tokenSecret: params.oauth_token_secret
	};

	var query = 'SELECT playerId FROM gree_user WHERE greeUserId = ? AND token = ? AND tokenSecret = ?';
	var params = [user.userId, user.token, user.tokenSecret];

	state.datasources.db.getOne(query, params, false, null, function(error, result) {
		if (error) return cb(error);

		if (result)
			cb(null, user, result.playerId);
		else
			cb(null, user, null);
	});
};


exports.resolveUser = function(state, userId, optional, cb)
{
	var query = 'SELECT playerId FROM gree_user WHERE greeUserId = ?';
	var params = [userId];

	state.datasources.db.getOne(query, params, !optional, null, function(error, playerId) {
		if (error) return cb(error);

		cb(null, playerId || null);
	});
};


exports.resolvePlayer = function(state, playerId, cb)
{
	if (users[playerId])
	{
		return cb(null, users[playerId]);
	}

	var query = 'SELECT greeUserId, token, tokenSecret FROM gree_user WHERE playerId = ?';
	var params = [playerId];

	state.datasources.db.getOne(query, params, true, null, function(error, user) {
		if (error) return cb(error);

		if (user)
			users[playerId] = user;

		cb(null, user);
	});
};


exports.registerUser = function(state, user, playerId, invitedByUserId, cb)
{
	// TODO: register invitedByUserId

	var sql = 'INSERT INTO gree_user VALUES(?, ?, ?, ?, ?)';
	var params = [playerId, user.userId, user.token, user.tokenSecret, 'installed'];

	state.datasources.db.exec(sql, params, null, function(error) { cb(error); });
};


exports.setStatus = function(state, playerId, newStatus, cb)
{
	var sql = 'UPDATE gree_user SET status = ? WHERE playerId = ?';
	var params = [newStatus, playerId];

	state.datasources.db.exec(sql, params, null, function(error) { cb(error); });
};


exports.getGadgetXml = function()
{
	// TODO: encode XML entities

	var url = 'http://' + mithril.core.config.server.expose.host + ':' + mithril.core.config.server.expose.port;

	eventUrls = {
		addapp:     url + apiPaths.addApp,
		suspendapp: url + apiPaths.suspendApp,
		resumeapp:  url + apiPaths.resumeApp,
		removeapp:  url + apiPaths.removeApp
	};

	var xml = [];

	xml.push('<?xml version="1.0" encoding="UTF-8" ?>');
	xml.push('<Module>');
	xml.push('	<ModulePrefs title="' + mithril.core.config.app.name + '">');

	for (var eventName in eventUrls)
	{
		xml.push('		<Link rel="event.' + eventName + '" href="' + eventUrls[eventName] + '" method="GET"/>');
	}

	xml.push('	</ModulePrefs>');
	xml.push('	<Content view="touch" type="url" href="' + url + apiPaths.login + '"/>');
	xml.push('</Module>');

	return xml.join('\n');
};


exports.getActorIds = function(state, userIds, cb)
{
	var query = 'SELECT playerId, greeUserId FROM gree_user WHERE greeUserId IN (' + userIds.map(function() { return '?'; }).join(', ') + ')';
	var params = userIds;

	state.datasources.db.getMapped(query, params, { key: 'greeUserId', value: 'playerId' }, null, cb);
};


exports.getUserIds = function(state, actorIds, cb)
{
	var query = 'SELECT playerId, greeUserId FROM gree_user WHERE playerId IN (' + actorIds.map(function() { return '?'; }).join(', ') + ')';
	var params = actorIds;

	state.datasources.db.getMapped(query, params, { key: 'playerId', value: 'greeUserId' }, null, cb);
};


exports.paymentStart = function(state, purchaseRequest, cb)
{
	// Initiates the payment

	// prepare the data

	var message = mithril.shop.hooks.getGenericPurchaseMessage(state.language());

	var items = [];

	for (var itemId in purchaseRequest.items)
	{
		var item = purchaseRequest.items[itemId];

		items.push({
			itemId: item.id,
			itemName: item.data.getOne('name', state.language(), null, null, 'item'),
			unitPrice: item.unitPrice,
			quantity: item.quantity,
			imageUrl: item.data.getOne('imageUrl', state.language(), null, null, null),
			description: item.data.getOne('desc', state.language(), null, null, '')
		});
	}

	exports.resolvePlayer(state, state.actorId, function(error, user) {
		if (error) return cb(error);

		exports.rest.startPayment(state, user, purchaseRequest, message, items, cb);
	});
};


var paymentPaid = function(state, paymentId, orderedTime, shopPurchaseId, cb)
{
	var sql = 'UPDATE gree_payment SET status = ?, orderedTime = ? WHERE id = ?';
	var params = ['paid', orderedTime, paymentId];

	state.datasources.db.exec(sql, params, null, function(error) {
		if (error) return cb(error);

		mithril.shop.purchasePaid(state, shopPurchaseId, function(error, purchaseResult) {
			if (error) return cb(error);

			if (mithril.persistent)
			{
				var propertyMap = new mithril.core.PropertyMap;
				propertyMap.add('lastpurchase', purchaseResult);

				mithril.persistent.set(state, propertyMap, null, cb);
			}
			else
				cb();
		});
	});
};


var paymentCancelled = function(state, paymentId, shopPurchaseId, cb)
{
	var sql = 'UPDATE gree_payment SET status = ? WHERE id = ?';
	var params = ['cancelled', paymentId];

	state.datasources.db.exec(sql, params, null, function(error) {
		if (error) return cb(error);

		mithril.shop.purchaseCancelled(state, shopPurchaseId, cb);
	});
};


var paymentExpired = function(state, paymentId, shopPurchaseId, cb)
{
	var sql = 'UPDATE gree_payment SET status = ? WHERE id = ?';
	var params = ['expired', paymentId];

	state.datasources.db.exec(sql, params, null, function(error) {
		if (error) return cb(error);

		mithril.shop.purchaseExpired(state, shopPurchaseId, cb);
	});
};


exports.paymentConfirm = function(request, path, params, cb)
{
	var state = new mithril.core.State;

	var callback = function(error, response) {
		state.close();
		cb(error, response);
	};

	if (!mithril.shop)
	{
		return state.error(null, 'Mithril module shop not found.', callback);
	}

	if (!oauth.isValidAppId(params.opensocial_app_id) || !oauth.isValidSignature(request.method, 'http://' + request.headers.host + path, params, request.headers.authorization))
	{
		return state.error(null, 'OAuth failed.', callback);
	}

	var paymentStatus = ~~params.status;
	var greePaymentId = params.paymentId;
	var userId = params.opensocial_viewer_id;

	if ([PAYMENT_PAID, PAYMENT_CANCELLED, PAYMENT_EXPIRED].indexOf(paymentStatus) == -1)
	{
		return state.error(null, 'Unrecognized payment status: ' + params.status, callback);
	}


	var query = 'SELECT gp.id, gp.playerId, gp.shopPurchaseId FROM gree_payment AS gp JOIN gree_user AS u ON u.playerId = gp.playerId WHERE gp.paymentId = ? AND u.greeUserId = ?';
	var params = [greePaymentId, userId];

	state.datasources.db.getOne(query, params, true, null, function(error, row) {
		if (error) return callback(error);

		var paymentId = row.id;
		var playerId = row.playerId;
		var shopPurchaseId = row.shopPurchaseId;

		state.actorId = playerId;

		switch (paymentStatus)
		{
			case PAYMENT_PAID:
				var orderedTime = params.orderedTime ? ~~(Date.parse(params.orderedTime) / 1000) : mithril.core.time;
				paymentPaid(state, paymentId, orderedTime, shopPurchaseId, callback);
				break;

			case PAYMENT_CANCELLED:
				paymentCancelled(state, paymentId, shopPurchaseId, callback);
				break;

			case PAYMENT_EXPIRED:
				paymentExpired(state, paymentId, shopPurchaseId, callback);
				break;

			default:
				state.error(null, 'Unrecognized payment status: ' + paymentStatus, callback);
				break;
		}
	});
};


// GREE REST API

exports.rest = {};


exports.rest.getUserInfo = function(state, user, aboutUserId, fields, cb)
{
	if (aboutUserId == user.userId)
	{
		this.getUsersInfo(state, user, null, 'self', { fields: fields }, cb);
	}
	else
	{
		this.getUsersInfo(state, user, aboutUserId, 'all', { fields: fields }, cb);
	}
};


exports.rest.getUsersInfo = function(state, user, aboutUserId, group, options, cb)
{
	// aboutUserId is optional

	// TODO: pagination
	// TODO: take ignoring into account

	var path = 'people/@me/@' + group;

	if (aboutUserId)
	{
		path += '/' + aboutUserId;
	}

	var params = {};

	if (options.fields)
	{
		params.fields = options.fields.join(',');
	}

	if (options.count)
	{
		params.count = options.count;
	}

	if (options.hasApp)
	{
		params.filterBy = 'hasApp';
		params.filterOp = 'equals';
		params.filterValue = 'true';
	}

	exports.send('GET', user, path, params, null, function(error, statusCode, result) {
		if (error) return cb(error);

		var results = result.entry;
		var len = results.length;

		// rewrite strings to decent types

		for (var i=0; i < len; i++)
		{
			var user = results[i];
			if (typeof user.id     === 'string') user.id = ~~user.id;
			if (typeof user.age    === 'string') user.age = ~~user.age;
			if (typeof user.hasApp === 'string') user.hasApp = (user.hasApp === 'true');
		}

		cb(null, results);
	});
};


exports.rest.getFriends = function(state, user, addActorIds, options, cb)
{
	if (!addActorIds)
	{
		return this.getUsersInfo(state, user, null, 'friends', options, cb);
	}

	// add actor IDs to the result set

	if (options.fields.indexOf('id')     == -1) options.fields.push('id');
	if (options.fields.indexOf('hasApp') == -1) options.fields.push('hasApp');

	this.getUsersInfo(state, user, null, 'friends', options, function(error, results) {
		if (error) return cb(error);

		// nobody found:

		if (results.length == 0) return cb(null, results);

		// resolve actor IDs

		var userIds = results.map(function(friend) { return ~~friend.id; });

		var query = 'SELECT playerId, greeUserId FROM gree_user WHERE greeUserId IN (' + userIds.map(function() { return '?'; }).join(', ') + ')';
		var params = userIds.concat([]);

		state.datasources.db.getMany(query, params, null, function(error, rows) {
			var len = rows.length;

			for (var i=0; i < len; i++)
			{
				var row = rows[i];
				var index = userIds.indexOf(~~row.greeUserId);

				if (index == -1) continue;

				results[index].actorId = row.playerId;
			}

			cb(null, results);
		});
	});
};


exports.rest.startPayment = function(state, user, purchase, message, items, cb)
{
	var url = 'http://' + mithril.core.config.server.expose.host + ':' + mithril.core.config.server.expose.port;

	var cfg = mithril.core.config.module.gree;

	var postData = {
		callbackUrl:   url + apiPaths.paymentConfirm,
		finishPageUrl: url + apiPaths.login,
		message:       message,
		paymentItems:  items
	};

	exports.send('POST', user, 'payment/@me/@self/@app', null, postData, function(error, statusCode, result) {

		if (error) return state.error(null, 'Received error ' + error + ' during payment attempt.', cb);

		if (!result.entry || !result.entry[0]) return state.error(null, 'Did not receive error, but also did not receive payment feedback from GREE.', cb);

		var payment = result.entry[0];


		// now store the payment in the GREE model

		var sql = 'INSERT INTO gree_payment VALUES(?, ?, ?, ?, ?, ?, ?)';
		var params = [null, state.actorId, payment.paymentId, mithril.core.time, null, 'new', purchase.id];

		state.datasources.db.exec(sql, params, null, function(error, info) {
			if (error) return cb(error);

			// store payment items

			var id = info.insertId;

			var sql = 'INSERT INTO gree_payment_item VALUES ';
			var values = [];
			var params = [];

			var len = items.length;
			for (var i=0; i < len; i++)
			{
				var item = items[i];

				values.push('(?, ?, ?, ?, ?)');
				params.push(null, id, item.description, item.unitPrice, item.quantity);
			}

			sql += values.join(', ');

			state.datasources.db.exec(sql, params, null, function(error) {
				if (error) return cb(error);

				// now return the redirect URL

				cb(null, { redirect: payment.transactionUrl });
			});
		});
	});
};


// communicating with GREE

exports.send = function(httpMethod, user, path, getParams, postData, cb)
{
	var cfg = mithril.core.config.module.gree;

	path = cfg.endpoint.path + (cfg.endpoint.path[cfg.endpoint.path.length - 1] == '/' ? '' : '/') + (path[0] == '/' ? path.substring(1) : path);

	var nonce = (new Date()).getTime() + user.userId;
	var timestamp = mithril.core.time;

	var oauthParams = [
		'oauth_consumer_key=' + cfg.consumer.key,
		'oauth_nonce=' + nonce,
		'oauth_signature_method=HMAC-SHA1',
		'oauth_timestamp=' + timestamp,
		'oauth_token=' + user.token,
		'oauth_version=1.0',
		'xoauth_requestor_id=' + user.userId
	];

	var url = cfg.endpoint.protocol + '://' + cfg.endpoint.host + path;

	if (getParams)
	{
		// add GET parameters to URL and to oauthParams

		var qs = [];

		for (var param in getParams)
		{
			var p = param + '=' + encodeRfc3986(getParams[param]);

			qs.push(p);
			oauthParams.push(p);
		}

		if (qs.length > 0)
		{
			path += '?' + qs.join('&');

			oauthParams.sort();
		}
	}

	var baseString = httpMethod.toUpperCase() + '&' + encodeRfc3986(url) + '&' + encodeRfc3986(oauthParams.join('&'));
	var oauthKey = cfg.consumer.secret + '&' + user.tokenSecret;

	var signature = crypto.createHmac('sha1', oauthKey).update(baseString).digest('base64');

	var authHeader = [
		'OAuth oauth_version="1.0"',
		'oauth_nonce=' + nonce,
		'oauth_timestamp=' + timestamp,
		'oauth_consumer_key=' + cfg.consumer.key,
		'oauth_token=' + user.token,
		'oauth_signature=' + encodeRfc3986(signature),
		'oauth_signature_method=HMAC-SHA1',
		'xoauth_requestor_id=' + user.userId
	];

	var headers = {
		Authorization: authHeader.join(',')
	};

	if (postData)
	{
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

	mithril.core.logger.debug('GREE: Q', options);

	var request = http.request(options, function(response) {
		// deal with HTTP response

		var statusCode = response.statusCode;

		if ((statusCode / 100) << 0 != 2)
		{
			mithril.core.logger.debug('GREE: A', statusCode);

			return cb(statusCode);
		}

		response.setEncoding('utf8');

		var data = '';

		response.on('data', function(chunk) {
			data += chunk;
		});

		response.on('end', function() {
			try
			{
				data = JSON.parse(data);
			}
			catch (e)
			{
				data = false;
			}

			mithril.core.logger.debug('GREE: A', data);

			cb(null, statusCode, data);
		});
	});

	// send

	if (postData)
		request.end(postData);
	else
		request.end();
};


function encodeRfc3986(str)
{
	return encodeURIComponent(str).replace(/\!/g,'%21').replace(/\*/g,'%2A').replace(/\(/g,'%28').replace(/\)/g,'%29').replace(/\'/g,'%27'); //.replace(/%2C/g, ',');	// gree doesn't like escaped commas
};


function CustomOAuth(endpoint, appId, consumer)
{
	this.endpoint = endpoint;
	this.appId = appId;
	this.consumer = consumer;
};


CustomOAuth.prototype.isValidAppId = function(appId)
{
	return (appId == this.appId);
};


CustomOAuth.prototype.isValidSignature = function(httpMethod, url, params, authHeader)
{
	if (authHeader)
	{
		authHeader = this.parseAuthorizationHeader(authHeader);
		for (var key in authHeader)
		{
			params[key] = authHeader[key];
		}
	}

	// check for availability of all required oauth params

	if (!('oauth_signature' in params)) return false;

	var signature = params.oauth_signature;
	var tokenSecret = ('oauth_token_secret' in params) ? params.oauth_token_secret : '';

	delete params.oauth_signature;

	var genSignature = this.generateSignature(httpMethod, url, params, tokenSecret);

	return (genSignature == signature);
};


CustomOAuth.prototype.generateSignature = function(httpMethod, url, params, tokenSecret)
{
	var sorted = [];

	for (var key in params)
	{
		sorted.push(key + '=' + encodeRfc3986(params[key]));
	}

	sorted.sort();

	var baseString = httpMethod.toUpperCase() + '&' + encodeRfc3986(url) + '&' + encodeRfc3986(sorted.join('&'));

	var oauthKey = this.consumer.secret + '&' + tokenSecret;

	return crypto.createHmac('sha1', oauthKey).update(baseString).digest('base64');
};


CustomOAuth.prototype.parseAuthorizationHeader = function(authHeader)
{
	// Authorization: OAuth oauth_version="1.0",oauth_nonce="32432423423423",oauth_timestamp="123123322",oauth_consumer_key="34ewr23fweafewewfwe",oauth_token="fwfewwefwfe",oauth_signature="Izti%2FxtMrMD5iZaLDm0Y%2B6Mm23g%3D",oauth_signature_method="HMAC-SHA1",oauth_token_secret="weffwefwefweefw"

	var matches = authHeader.match(/oauth_([a-z_-]*)=(:?"([^"]*)"|([^,]*))/g);
	var len = matches.length;
	var result = {};

	for (var i=0; i < len; i++)
	{
		// oauth_nonce="32432423423423"  etc...

		var match = matches[i].split('=');
		var key = match[0];
		var value = match[1];

		if (value[0] == '"' && value[value.length-1] == '"')
		{
			value = value.substring(1, value.length-1);
		}

		result[key] = unescape(value);
	}

	return result;
};


