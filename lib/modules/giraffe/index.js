var mithril = require('../../mithril'),
    crypto = require('crypto'),
    async = require('async'),
    common = require('./common'),
    http = require('http'),
    OAuth = require('oauth').OAuth,
	querystring = require('querystring');

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


exports.getTokenSecretForSession = function (state, cb) {

	mithril.actor.getActorProperties(state, state.session.actorId, { load: ['tokenSecret'] }, function (error, data) {
		if (error) {
			return cb(error);
		}
		
		var secret = data.get('tokenSecret'); 

		if (!secret) {
			return state.error('auth', 'Token secret missing', cb);
		}

		cb(null, secret);
	});
};


function messageHook(state, params, message, cb) {

	if (!state.session) {
		return state.error('auth', 'The giraffe hook needs a valid session to process authentication.', cb);
	}

	exports.getTokenSecretForSession(state, function (error, tokenSecret) {
		if (error) {
			return cb(error);
		}

		var src = tokenSecret + params.nonce + params.timestamp + message;
		var hash = crypto.createHash('sha256').update(src).digest('hex');
		
		if (hash !== params.hash) {
			return state.error('auth', 'The giraffe hash is not valid', cb);
		}

		cb(null, message);
	});
}


exports.setup = function (state, cb) {
	var cfg = mithril.core.config.get('module.giraffe');

	if (!cfg) {
		mithril.core.logger.error('Giraffe module has no configuration');
		return cb(true);
	}

	var httpServer = mithril.core.msgServer.getHttpServer();

	for (var api in cfg.expose) {
		var path = cfg.expose[api];

		apiPaths[api] = path;

		if (httpServer) {
			httpServer.addRoute(path, handleHttpRequest);
		} else {
			mithril.core.logger.error('Could not add route ' + path + ', because there is no HTTP server.');
		}
	}

	// TODO: This should actually be a usercommand that is allowed be executed without authentication

	apiPaths.getSession = '/giraffe/getsession';

	oauth = new OAuth('', '', cfg.consumer.key, cfg.consumer.secret, '1.0', null, 'HMAC-SHA1');

	if (httpServer) {
		httpServer.addRoute(apiPaths.getSession, handleHttpRequest);
	} else {
		mithril.core.logger.error('Could not add route ' + apiPaths.getSession + ', because there is no HTTP server.');
	}

	mithril.core.msgServer.registerMessageHook('giraffe', messageHook);

	cb();
};


function tryAuthenticate(state, request, path, reqParams, resolvePlayer, cb) {

	if (!reqParams.hasOwnProperty('user_id')) {
		return state.error(null, 'noUserId', cb);
	}

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

	//TODO: token match incoming userObj tokens against those pulled out below:

	//var query = 'SELECT a.id AS playerId, ad2.value AS token, ad3.value AS tokenSecret FROM actor AS a JOIN actor_data AS ad1 ON a.id = ad1.actor AND ad1.property = ? AND ad1.value = ? JOIN actor_data AS ad2 ON a.id = ad2.actor AND ad2.property = ? JOIN actor_data AS ad3 ON a.id = ad3.actor AND ad3.property = ?';
	//var params = ['giraffeUser', user.userId, 'token', 'tokenSecret'];

	var query = 'SELECT ad.actor AS playerId, ad2.value AS token, ad3.value AS tokenSecret FROM actor_data AS ad JOIN actor_data AS ad2 ON ad2.actor = ad.actor AND ad2.property = ? JOIN actor_data AS ad3 ON ad3.actor = ad.actor AND ad3.property = ? WHERE ad.property = ? and ad.value = ?';
	var params = ['token', 'tokenSecret', 'giraffeUser', user.userId];

	state.datasources.db.getOne(query, params, false, null, function (error, result) {
		if (error) {
			return cb(error);
		}

		if (result && (result.token !== user.token || result.tokenSecret !== user.tokenSecret)) { //user has switched device or something
			// store new values

			var pm = new mithril.core.PropertyMap();
			pm.add('token', user.token);
			pm.add('tokenSecret', user.tokenSecret);

			mithril.actor.setProperties(state, result.playerId, pm, function (err) {
				if (err) {
					return cb(err);
				}
				return cb(null, user, result.playerId);
			});
		} else if (result) {
			cb(null, user, result.playerId); //follows exiting user path
		} else {
			cb(null, user, null); //now follows the newUserPath
		}
	});
}


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

	var checkAndUpdateUser = function (error, data) {

		if (error) {
			return cb(404, exports.hooks.getAuthenticationFailedMessage());
		}

		tryAuthenticate(state, request, path, params, true, function (error, user, playerId) { //this just checks the DB now!
			if (error) {
				state.close();
				return cb(404, exports.hooks.getAuthenticationFailedMessage());
			}

			var onComplete = function (error, data) {
				state.close();

				if (error) {
					return cb(404, data || exports.hooks.getLoginFailedMessage());
				}

				// We don't redirect anymore
				cb(200, data);
			};

			if (playerId) {
				//exports.onLogin(state, playerId, onComplete);
				onComplete(null, JSON.stringify({ success: true }));
			} else {
				exports.onNewPlayer(state, user, user.userId, function (error, newPlayerId) {
					if (error) {
						return onComplete(error);
					}

					exports.registerUser(state, user, newPlayerId, null, function (error) {
						if (error) {
							return onComplete(error);
						}

						//exports.onLogin(state, newPlayerId, onComplete);
						onComplete(null, JSON.stringify({ success: true }));
					});
				});
			}
		});
	};

	mithril.giraffe.send('get', {token: params.access_token, tokenSecret: params.access_secret}, '/Gameplatform/UserMe', { user_id: params.user_id }, null, checkAndUpdateUser);

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
	var sessionId, playerId, token, tokenSecret;

	async.waterfall([
		function (callback) {
			// We first retrieve the tokenSecret and playerId corresponding to the giraffeUserId

			var sql = 'SELECT actor as playerId FROM actor_data WHERE actor IN (SELECT a.actor FROM actor_data as a WHERE a.property = ? AND a.value = ?)';

			state.datasources.db.getOne(sql, ['giraffeUser', giraffeUserId], false, null, callback);

		},
		function (data, callback) {
			if (!data || !data.playerId) {
				return state.error(null, 'User is not registered.', callback);
			}

			playerId = data.playerId;

			// We then need to retrieve the token
			mithril.actor.getProperties(state, playerId, ['token', 'tokenSecret'], callback);
		},
		function (data, callback) {
			// Check if the user actually exists

			if (!data || !data.token || !data.tokenSecret) {
				return state.error(null, 'User has no token/tokenSecret', callback);
			}

			token = data.token;
			tokenSecret = data.tokenSecret;

			// We then verify the hash

			var src = tokenSecret + nonce + timestamp + 'giraffeUserId=' + giraffeUserId;
			var validhash = crypto.createHash('sha256').update(src).digest('hex');

			if (hash !== validhash) {
				return state.error(null, 'Hash is not valid', callback);
			}

			// Get latest user data from Giraffe API
			mithril.giraffe.send('get', {token: token, tokenSecret: tokenSecret}, '/Gameplatform/UserMe', { user_id: giraffeUserId, access_token: token, access_secret: tokenSecret }, null, callback);

		},
		function (data, callback) {
			if (!data || !data.profile) {
				return state.error(null, "Couldn't retrieve Giraffe data", callback);
			}
			exports.onLogin(state, playerId, data, callback);
		},
		function (callback) {

			// We create a new session
			mithril.session.register(state, playerId, callback);
		},
		function (session, callback) {
			sessionId = session.getFullKey();

			callback();
		}
	], function (err) {
		state.close();

		if (err) {
			// TODO: To replace with a generic error message
			return cb(401, "Couldn't create the session");
		}

		// We send the session back

		var response = {
			sessionId: sessionId
		};

		cb(200, JSON.stringify(response), { 'content-type': 'application/json; charset=utf-8' });
	});
};


exports.send = function (httpMethod, user, path, getParams, postData, cb) {

	var cfg = mithril.core.config.get('module.giraffe');

	var url = cfg.endpoint.protocol + '://' + cfg.endpoint.host + path;

	var urlParams = querystring.stringify(getParams);

	oauth.getProtectedResource(url + '?' + urlParams, 'GET', user.token, user.tokenSecret,  function (error, data, response) {
		if (error) {
			mithril.core.logger.error('Giraffe API call error:', error);
			return cb(error);
		}

		try {
			data = JSON.parse(data);
		} catch (e) {
			data = false;
		}

		mithril.core.logger.debug('GIRAFFE: A', data);

		cb(null, data);
	});
};


exports.pushNotification = function (state, receiverId, message, options, cb) {
	if (!receiverId) {
		return state.error(null, 'Need a receiver for the push notification.', cb);
	}

	if (!message) {
		return state.error(null, 'No message provided for the push notification to actor ' + receiverId, cb);
	}

	mithril.actor.getProperties(state, receiverId, ['giraffeUser', 'token', 'tokenSecret'], function (error, data) {
		if (error) {
			return cb(error);
		}

		if (!data || !data.giraffeUser || !data.token || !data.tokenSecret) {
			return state.error(null, 'Giraffe user data is missing.', cb);
		}

		// TODO: Check if options

		var params = {
			receiver_id: data.giraffeUser,
			message: message
		};

		exports.send('get', data, '/Gameplatform/ApplicationNotificationMessage', params, null, cb);
	});
};

