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
	}
	cb(false);
};


function resolveActor(state, actorId, optional, cb) {
	mithril.actor.getActorProperties(state, actorId, { load: ['giraffeUserId'] }, function (error, props) {
		if (error) {
			return cb(error);
		}

		var userId = props.get('giraffeUserId');

		if (!optional && !userId) {
			return state.error(null, 'Could not resolve actorId ' + actorId + ' to a giraffeUserId', cb);
		}

		cb(null, userId);
	});
}


exports.getTokenSecretForSession = function (state, cb) {
	resolveActor(state, state.session.actorId, true, function (error, userId) {
		if (error) {
			return cb(error);
		}

		if (!userId) {
			return state.error('auth', 'Giraffe user ID not found for actor ' + state.session.actorId, cb);
		}

		exports.getUserProperties(state, userId, { load: ['tokenSecret'] }, function (error, data) {
			if (error) {
				return cb(error);
			}

			var secret = data.get('tokenSecret');

			if (!secret) {
				return state.error('auth', 'Token secret missing', cb);
			}

			cb(null, secret);
		});
	});
};


exports.getUserProperties = function (state, userId, options, cb) {
	var	domain = {
		id: userId,
		key: 'giraffe/' + userId
	}

	mithril.core.LivePropertyMap.create(state, domain, options, cb);
};


function messageHook(state, params, message, cb) {

	if (!state.session) {
		return state.error('auth', 'The giraffe hook needs a valid session to process authentication.', cb);
	}

	var userId = params.userId;	// soon to be used in getTokenSecretForSession

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

	oauth = new OAuth('', '', cfg.consumer.key, cfg.consumer.secret, '1.0', null, 'HMAC-SHA1');

	mithril.core.msgServer.registerMessageHook('giraffe', messageHook);

	cb();
};


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


exports.httpReqLogin = function (request, path, params, cb) {
	var user = {
		userId: params.user_id,
		token: params.access_token,
		tokenSecret: params.access_secret
	};

	if (!user.userId || !user.token || !user.tokenSecret) {
		return cb(401, 'User information incomplete.');
	}


	var state = new mithril.core.State();

	function callback(error) {
		state.close();

		if (error) {
			mithril.core.logger.error('Giraffe login error:', error);
			cb(401, error);
		} else {
			cb(200, '{"success":true}');
		}
	}

	exports.send('get', { token: user.token, tokenSecret: user.tokenSecret }, '/Gameplatform/UserMe', { user_id: user.userId }, null, function (error, userData) {
		if (error) {
			return callback('Inconsistency in user account detected.');
		}

		exports.getUserProperties(state, user.userId, { load: ['actorId'] }, function (error, props) {
			if (error) {
				return callback(error);
			}
			var actorId = props.get('actorId');

			// Set the token and tokenSecret. Even if they already existed, they may have changed.
			props.set('token', user.token);
			props.set('tokenSecret', user.tokenSecret);
			if (actorId) {

				// The player already exists, so we can return.
				callback();
			} else {
				// New player event
				exports.onNewPlayer(state, user, userData, function (error, actorId) {
					if (error) {
						return callback(error);
					}
					props.set('actorId', actorId);

					// Store the user ID on the actor property map
					mithril.actor.getActorProperties(state, actorId, {}, function (error, actorProps) {
						if (error) {
							return callback(error);
						}
						actorProps.set('giraffeUserId', user.userId);
						callback();
					});
				});
			}
		});
	});
};



/* Create and send back a new session for a player who is registered and has a tokenSecret and a giraffeUserId. The query must be signed.

PARAMS :
	giraffeUserId
	nonce
	timestamp
	hash

The hash is a hexadecimal digest of the SHA256 of the following string:
tokenSecret + nonce + timestamp + 'giraffeUserId=' + giraffeUserId

OUTPUT
	sessionId
*/


exports.getSession = function (state, giraffeUserId, nonce, timestamp, hash, cb) {
	if (!giraffeUserId || !nonce || !timestamp || !hash) {
		return state.error('auth', 'Parameter is missing in giraffe.getSession()', cb);
	}

	exports.getUserProperties(state, giraffeUserId, { load: ['actorId', 'token', 'tokenSecret'] }, function (error, userProps) {
		if (error) {
			return cb(error);
		}

		// pull out and check for required properties

		var actorId = userProps.get('actorId');
		var token = userProps.get('token');
		var tokenSecret = userProps.get('tokenSecret');

		if (!actorId || !token || !tokenSecret) {
			return state.error(null, 'User ' + giraffeUserId + ' has no actorId, token or tokenSecret.', cb);
		}

		// verify the hash

		var src = tokenSecret + nonce + timestamp + 'giraffeUserId=' + giraffeUserId;
		var validhash = crypto.createHash('sha256').update(src).digest('hex');

		if (hash !== validhash) {
			return state.error('auth', 'Giraffe hash is not valid', cb);
		}

		// receive user information from giraffe service

		exports.send('get', { token: token, tokenSecret: tokenSecret }, '/Gameplatform/UserMe', { user_id: giraffeUserId, access_token: token, access_secret: tokenSecret }, null, function (error, data) {
			if (error) {
				return state.error('auth', error, cb);
			}

			if (!data || !data.profile) {
				return state.error(null, "Couldn't retrieve user information from giraffe service.", cb);
			}

			// allow game logic to take place on login

			exports.onLogin(state, actorId, data, function (error) {
				if (error) {
					return cb(error);
				}

				// register a new session for this actor

				mithril.session.register(state, actorId, function (error, session) {
					if (error) {
						return cb(error);
					}

					// return the session to the client

					var sessionId = session.getFullKey();

					cb(null, sessionId, { 'content-type': 'application/json; charset=utf-8' });
				});
			});
		});
	});
};


exports.send = function (httpMethod, user, path, getParams, postData, cb) {

	var cfg = mithril.core.config.get('module.giraffe');	// TODO: move this to setup()

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

