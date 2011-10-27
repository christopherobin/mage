var mithril = require('../../mithril'),
	crypto = require('crypto'),
	async = require('async'),
	common = require('./common'),
	http = require('http'),
	OAuth = require('./oauth').OAuth;

var oauth = null;
var users = {};
var apiPaths = {};


exports.onNewPlayer = null;  // function (state, user, cb) { ... } -> cb(null, playerId); or cb(error);
exports.onLogin = null;      // function (state, playerId, isNewPlayer, cb) { ... } -> cb(null, redirectUrl, 'Welcome!'); or cb(error);
exports.onLoginFail = null;  // function (cb) { ... } -> cb('Sorry');


exports.hooks = {
	getAuthenticationFailedMessage: function () {
		return 'Authentication failed.';
	},
	getLoginFailedMessage: function () {
		return 'Login failed.';
	}
};


var handleHttpRequest = function (request, path, params, cb) {
	mithril.core.logger.info('Giraffe: received request: ' + path);

	switch (path) {
	case apiPaths.login:
		return exports.httpReqLogin(request, path, params, cb);

	case apiPaths.getSession:
		return exports.httpReqGetSession(request, path, params, cb);
	}

	cb(false);
};


exports.setup = function (state, cb) {
	var cfg = mithril.getConfig('module.giraffe');

	if (!cfg) {
		mithril.core.logger.error('Giraffe module has no configuration');
		return cb(true);
	}

	for (var api in cfg.expose) {
		var path = cfg.expose[api];

		if (path[0] !== '/') {
			path = '/' + path;
		}

		apiPaths[api] = path;

		mithril.addRoute(path, handleHttpRequest);
	}

	// TODO: Need to put the following in the config file
	// REAL TODO: This should actually be a usercommand that is allowed be executed without authentication

	apiPaths.getSession = '/giraffe/getsession';
	mithril.addRoute('/giraffe/getsession', handleHttpRequest);

	oauth = new OAuth(cfg.endpoint, cfg.appId, cfg.consumer);

	mithril.core.msgServer.registerMessageHook('giraffe', function (state, params, message, regCb) {

		if (!state.session) {
			return state.error('expectedSession', 'mauth needs a valid session to process authentication', regCb);
		}

		mithril.giraffe.getTokenSecretForSession(state, function (error, tokenSecret) {
			if (error) {
				return regCb(error);
			}

			var src = tokenSecret + params.nonce + params.timestamp + message;
			var hash = crypto.createHash('sha256').update(src).digest('hex');
			console.log("Client params: ", params);
			console.log("Source: ", src);
			console.log("Server hash: ", hash);
			console.log("Token secret: ", tokenSecret);

			if (hash !== params.hash) {
				return state.error('authenticationFailed', 'The hash is not valid', regCb);
			}

			regCb(null, message);
		});
	});

	cb();
};


function tryAuthenticate(state, request, path, reqParams, resolvePlayer, cb) {

	if (!reqParams.hasOwnProperty('user_id')) {
		return state.error(null, 'noUserId', cb);
	}

	/*if (!oauth.isValidSignature(request.method, 'http://' + request.headers.host + path, reqParams, request.headers.authorization)) {
		return state.error(null, 'Invalid signature: ' + JSON.stringify({ method: request.method, url: 'http://' + request.headers.host + path, reqParams: reqParams, auth: request.headers.authorization }), cb);
	}*/

	if (!resolvePlayer) {
		return cb();
	}

	if (!reqParams.user_id || !reqParams.access_token || !reqParams.access_secret) {
		return state.error(null, 'Tried to resolve player, but no user information was found in the GET parameters of this request.', cb);
	}

	var user = {
		userId: reqParams.user_id,
		token: reqParams.access_token,
		tokenSecret: reqParams.access_secret
	};

	//TODO: match incoming userObj tokens against those pulled out below:

	var query = 'SELECT a.id AS playerId, ad2.value AS token, ad3.value AS tokenSecret FROM actor AS a JOIN actor_data AS ad1 ON a.id = ad1.actor AND ad1.property = ? AND ad1.value = ? JOIN actor_data AS ad2 ON a.id = ad2.actor AND ad2.property = ? JOIN actor_data AS ad3 ON a.id = ad3.actor AND ad3.property = ?';
	var params = ['giraffeUser', user.userId, 'token', 'tokenSecret'];

	state.datasources.db.getOne(query, params, false, null, function (error, result) {
		if (error) {
			return cb(error);
		}

		if (result) {
			cb(null, user, result.playerId);
		} else {
			cb(null, user, null);
		}
	});
}

/*
 * not in use
function resolveUser(state, giraffeUserId, optional, cb) {
	var query = 'SELECT a.id FROM actor AS a JOIN actor_data AS ad ON a.id = ad.actorId AND ad.property = ? and ad.value = ?';
	var params = ['giraffeUser', giraffeUserId];

	state.datasources.db.getOne(query, params, !optional, null, function (error, playerId) {
		if (error) {
			return cb(error);
		}

		cb(null, playerId || null);
	});
}
*/

/*
 * not in use
function resolvePlayer(state, playerId, cb) {
	if (users[playerId]) {
		return cb(null, users[playerId]);
	}

	var user = {};

	mithril.actor.getProperties(state, state.actorId, ['giraffeUser', 'token', 'tokenSecret'], function (err, data) {
		if (err) {
			return cb(err);
		}

		user.userId = data.giraffeUser;
		user.token = data.token;
		user.tokenSecret = data.tokenSecret;
		users[playerId] = user;
		cb(null, user);
	});
}
*/


exports.registerUser = function (state, user, playerId, invitedByUserId, cb) {
	// TODO: register invitedByUserId
	var pm = new mithril.core.PropertyMap();
	pm.add('token', user.token);
	pm.add('tokenSecret', user.tokenSecret);
	pm.add('giraffeUser', user.userId);

	mithril.actor.setProperties(state, playerId, pm, cb);
};


exports.httpReqLogin = function (request, path, params, cb) {
	var state = new mithril.core.State();

	tryAuthenticate(state, request, path, params, true, function (error, user, playerId) { //resolves player
		if (error) {
			state.close();
			return cb(404, exports.hooks.getAuthenticationFailedMessage());
		}

		var onComplete = function (error, redirectUrl, data) {
			state.close();

			if (error) {
				return cb(404, data || exports.hooks.getLoginFailedMessage());
			}

			// We don't redirect anymore
			cb(200, data);
		};

		if (playerId) {
			exports.onLogin(state, playerId, onComplete);
		} else {
			exports.onNewPlayer(state, user, user.userId, function (error, newPlayerId) {
				if (error) {
					return onComplete(error);
				}

				exports.registerUser(state, user, newPlayerId, null, function (error) {
					if (error) {
						return onComplete(error);
					}

					exports.onLogin(state, newPlayerId, onComplete);
				});
			});
		}
	});
};


exports.getTokenSecretForSession = function (state, cb) {

	mithril.actor.getProperties(state, state.session.playerId, ['tokenSecret'], function (error, data) {
		if (error) {
			return cb(error);
		}

		if (!data.tokenSecret) {
			return state.error('badSession', 'Token secret missing', cb);
		}

		cb(null, data.tokenSecret);

	});
};


/* Create and send back a new session for a player who is registered and has a tokenSecret and a giraffeUserId. The query mustbe signed.

PARAMS :
	giraffeUserID
	nonce
	timestamp
	hash

The hash is a hexadecimal digest of the SHA256 of the following string:
tokenSecret + nonce + timestamp + 'giraffeUserId=' + giraffeUserId

OUTPUT
	sessionId
	playerId
*/
exports.httpReqGetSession = function (request, path, params, cb) {
	var giraffeUserId = params.giraffeUserId;
	var nonce = params.nonce;
	var timestamp = params.timestamp;
	var hash = params.hash;

	if (!giraffeUserId || !nonce || !timestamp || !hash) {
		return cb(401, 'Parameter is missing');
	}

	var state = new mithril.core.State();
	var sessionId, playerId;

	async.waterfall([
		function (callback) {
			// We first retrieve the tokenSecret and playerId corresponding to the giraffeUserId

			var sql = 'SELECT actor as playerId, value as tokenSecret FROM actor_data WHERE actor IN (SELECT a.actor FROM actor_data as a WHERE a.property = ? AND a.value = ?) AND property = ?';

			state.datasources.db.getOne(sql, ['giraffeUser', giraffeUserId, 'tokenSecret'], false, null, callback);
		},
		function (data, callback) {
			// Check if the user actually exists

			if (!data || !data.tokenSecret || !data.playerId) {
				return state.error(null, 'User is not registered', callback);
			}

			playerId = data.playerId;

			// We then verify the hash

			var src = data.tokenSecret + nonce + timestamp + 'giraffeUserId=' + giraffeUserId;
			var validhash = crypto.createHash('sha256').update(src).digest('hex');

			if (hash !== validhash) {
				return state.error(null, 'Hash is not valid', callback);
			}

			// We create a new session
			mithril.player.sessions.register(state, data.playerId, callback);
		},
		function (data, callback) {
			sessionId = data.key;

			callback();
		}
	], function (err) {
		state.close();

		if (err) {
			// TODO: To replace with a generic error message
			return cb(401, err);
		}

		// We send the session back

		var response = {
			sessionId: sessionId,
			playerId: playerId
		};

		cb(200, JSON.stringify(response), { "content-type": 'application/json; charset=utf-8' });
	});
};


exports.send = function (httpMethod, user, path, getParams, postData, cb) {
	var cfg = mithril.getConfig('module.giraffe');

	// TODO: this line does belong here, so the configuration entry also needs to exist (perhaps empty string, but still...)
	// path = cfg.endpoint.path + (cfg.endpoint.path[cfg.endpoint.path.length - 1] === '/' ? '' : '/') + (path[0] === '/' ? path.substring(1) : path);

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

	if (getParams) {
		// add GET parameters to URL and to oauthParams

		var qs = [];

		for (var param in getParams) {
			var p = param + '=' + common.encodeRfc3986(getParams[param]);

			qs.push(p);
			oauthParams.push(p);
		}

		if (qs.length > 0) {
			path += '?' + qs.join('&');

			oauthParams.sort();
		}
	}

	var baseString = httpMethod.toUpperCase() + '&' + common.encodeRfc3986(url) + '&' + common.encodeRfc3986(oauthParams.join('&'));
	var oauthKey = cfg.consumer.secret + '&' + user.tokenSecret;

	var signature = crypto.createHmac('sha1', oauthKey).update(baseString).digest('base64');

	var authHeader = [
		'OAuth oauth_version="1.0"',
		'oauth_nonce=' + nonce,
		'oauth_timestamp=' + timestamp,
		'oauth_consumer_key=' + cfg.consumer.key,
		'oauth_token=' + user.token,
		'oauth_signature=' + common.encodeRfc3986(signature),
		'oauth_signature_method=HMAC-SHA1',
		'xoauth_requestor_id=' + user.userId
	];

	var headers = {
		Authorization: authHeader.join(',')
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

	mithril.core.logger.debug('GIRAFFE: Q', options);

	var request = http.request(options, function (response) {
		// deal with HTTP response

		var statusCode = response.statusCode;

		if (~~(statusCode / 100) !== 2) {
			mithril.core.logger.debug('GIRAFFE: A', statusCode);

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

			mithril.core.logger.debug('GIRAFFE: A', data);

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

