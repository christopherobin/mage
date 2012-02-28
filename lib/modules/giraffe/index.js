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

exports.getManageCommands = function () {
    return ['getActorIdFromGiraffeId'];
};


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

	if (path === apiPaths.login) {
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


exports.getUserProperties = function (state, userId, options, cb) {
	var domain = {
		id: userId,
		key: 'giraffe/' + userId
	};

	mithril.core.LivePropertyMap.create(state, domain, options, cb);
};


function messageHook(state, params, messageData, cb) {
	// TODO: use memo, to avoid useless hash checks

	exports.getUserProperties(state, params.userId, { load: ['tokenSecret'] }, function (error, data) {
		if (error) {
			return cb(error);
		}

		var tokenSecret = data.get('tokenSecret');

		if (!tokenSecret) {
			return state.error('auth', 'Token secret missing', cb);
		}

		var src = tokenSecret + params.nonce + params.timestamp + messageData;

		var hash = crypto.createHash('sha256').update(src).digest('hex');

		if (hash !== params.hash) {
			return state.error('auth', 'The giraffe hash is not valid', cb);
		}

		cb();
	});
}


var cfg;

exports.setup = function (state, cb) {
	cfg = mithril.core.config.get('module.giraffe');

	if (!cfg) {
		mithril.core.logger.error('Giraffe module has no configuration');
		return cb(true);
	}

	var httpServer = mithril.core.msgServer.getHttpServer();

	// TODO: instead of this funky looping, we should just httpServer.addRoute(cfg.expose.login, httpReqLogin);

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

	mithril.core.cmd.registerMessageHook('giraffe', messageHook);

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
		state.onclose = function () {
			if (error) {
				mithril.core.logger.error('Giraffe login error:', error);
				cb(401, error);
			} else {
				cb(200, '{"success":true}');
			}
		};

		state.close();
	}

	// request profile information (name, image)

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

			// register a new session for this actor

			mithril.session.register(state, actorId, function (error, session) {
				if (error) {
					return cb(error);
				}

				// allow game logic to take place on login

				exports.onLogin(state, data, function (error) {
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

	var url = cfg.endpoint.protocol + '://' + cfg.endpoint.host + path;

	var fnReturnCb = function (error, data, response) {
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
	};

	switch(httpMethod) {
	case "get":
		getParams = querystring.stringify(getParams);
		oauth.getProtectedResource(url + '?' + getParams, 'GET', user.token, user.tokenSecret, fnReturnCb);
		break;
	case "post":
		try {
			postData = JSON.stringify(postData);
		} catch (e) {
			postData = null;
		}
		oauth.post(url, user.token, user.secret, postData, "application/json", fnReturnCb);
		break;
	default:
		cb(null, null);
		break;
	}
};


function pushNotificationToUser(state, giraffeUserId, message, options, cb) {
	// It has been announced that Giraffe will some day support specific options for scheduling, etc
	// For that reason we already provide an options arguments, but currently ignore it.

	if (!message) {
		return state.error(null, 'No message provided for the push notification to user ' + giraffeUserId, cb);
	}

	exports.getUserProperties(state, giraffeUserId, { load: ['token', 'tokenSecret'] }, function (error, props) {
		if (error) {
			return cb(error);
		}

		var user = {
			token: props.get('token'),
			tokenSecret: props.get('tokenSecret')
		};

		if (!user.token || !user.tokenSecret) {
			return state.error(null, 'Giraffe user data is missing for user ' + giraffeUserId, cb);
		}

		var params = {
			receiver_id: giraffeUserId,
			message: message
		};

		exports.send('get', user, '/Gameplatform/ApplicationNotificationMessage', params, null, function (err) {
            if (err) {
                return cb(err);
            }
            cb();
        });
	});
}


exports.pushNotification = function (state, actorId, message, options, cb) {
	resolveActor(state, actorId, false, function (error, userId) {
		if (error) {
			return cb(error);
		}

		pushNotificationToUser(state, userId, message, options, cb);
	});
};

