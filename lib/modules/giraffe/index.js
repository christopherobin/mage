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
    return ['getActorIdFromGiraffeId', 'broadcast'];
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


function resolveActors(state, actorIds, cb) {

	mithril.actor.getActorsProperties(state, actorIds, { load: ['giraffeUserId'] }, function (err, props) {
		if (err) {
			return cb(err);
		}
		var map = {};

		for (var actorId in props) {
			map[actorId] = props[actorId].get('giraffeUserId');
		}

		cb(null, map);

	});

}


exports.getUserProperties = function (state, userId, options, cb) {
	var domain = {
		id: userId,
		key: 'giraffe/' + userId
	};

	mithril.core.LivePropertyMap.create(state, domain, options, cb);
};


exports.getUsersProperties = function (state, userIds, options, cb) {
	var len = userIds.length;
	var domains = new Array(len);

	for (var i = 0; i < len; i += 1) {
		var userId = userIds[i];

		domains[i] = {
			id: userId,
			key: 'giraffe/' + userId
		};
	}

	mithril.core.LivePropertyMap.createMany(state, domains, options, cb);
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
		state.close(function () {
			if (error) {
				mithril.core.logger.error('Giraffe login error:', error);
				cb(401, error);
			} else {
				cb(200, '{"success":true}');
			}
		});
	}

	// request profile information (name, image)

	exports.send('get', { token: user.token, tokenSecret: user.tokenSecret }, '/Gameplatform/UserMe', { user_id: user.userId }, null, function (error, userData) {
		if (error) {
			return callback('Inconsistency in user account detected.');
		}

		exports.getUserProperties(state, user.userId, { optional: ['actorId'] }, function (error, props) {
			if (error) {
				return callback(error);
			}

			// we check both the propertyList and the actual key for actorId
			// it should be unnecessary, but we want to be absolutely sure we don't have a "new player" false alarm.

			if (props.has('actorId') || props.exists('actorId')) {
				// this player exists, so we update token and tokenSecret, and return

				var actorId = props.get('actorId');
				if (!actorId) {
					return callback('Actor exists, yet actorId was not found on Giraffe User properties');
				}

				// Set the token and tokenSecret, since they may have changed.

				props.set('token', user.token);
				props.set('tokenSecret', user.tokenSecret);

				return callback();
			}

			// Create a new player for this giraffe user

			exports.onNewPlayer(state, user, userData, function (error, actorId) {
				if (error) {
					return callback(error);
				}

				props.set('actorId', actorId);
				props.set('token', user.token);
				props.set('tokenSecret', user.tokenSecret);

				// Store the user ID on the actor property map

				mithril.actor.getActorProperties(state, actorId, {}, function (error, actorProps) {
					if (error) {
						return callback(error);
					}

					actorProps.set('giraffeUserId', user.userId);
					callback();
				});
			});
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
	if (!giraffeUserId) {
		return state.error('auth', 'No giraffeUserId given in giraffe.getSession(): ' + giraffeUserId, cb);
	}

	if (!nonce) {
		return state.error('auth', 'No nonce given in giraffe.getSession(): ' + nonce, cb);
	}

	if (!timestamp) {
		return state.error('auth', 'No timestamp given in giraffe.getSession(): ' + timestamp, cb);
	}

	if (!hash) {
		return state.error('auth', 'No hash given in giraffe.getSession(): ' + hash, cb);
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

	if (getParams) {
		url += '?' + querystring.stringify(getParams);
	}

	switch (httpMethod) {
	case 'get':
		oauth.getProtectedResource(url, 'GET', user.token, user.tokenSecret, fnReturnCb);
		break;

	case 'post':
		try {
			postData = JSON.stringify(postData);
		} catch (e) {
			postData = null;
		}

		oauth.post(url, user.token, user.secret, postData, 'application/json', fnReturnCb);
		break;

	default:
		mithril.core.logger.error('Invalid httpMethod given to giraffe.send:', httpMethod);
		cb(true);
		break;
	}
};


function pushNotificationToUser(giraffeUserId, tokenInfo, message, options, cb) {
	// It has been announced that Giraffe will some day support specific options for scheduling, etc
	// For that reason we already provide an options arguments, but currently ignore it.

	if (!message) {
		mithril.core.logger.error('No message provided for the push notification to user ' + giraffeUserId);
		return cb('noNotificationMessage');
	}

	if (!tokenInfo.token || !tokenInfo.tokenSecret) {
		mithril.core.logger.error('Giraffe user data is missing for user ' + giraffeUserId);
		return cb('noUserData');
	}

	var params = {
		receiver_id: giraffeUserId,
		message: message
	};

	exports.send('get', tokenInfo, '/Gameplatform/ApplicationNotificationMessage', params, null, function (err) {
        if (err) {
            return cb(err);
        }

        cb();
    });
}


exports.pushNotification = function (state, actorId, message, options, cb) {
	resolveActor(state, actorId, false, function (error, giraffeUserId) {
		if (error) {
			return cb(error);
		}

		exports.getUserProperties(state, giraffeUserId, { load: ['token', 'tokenSecret'] }, function (error, props) {
			if (error) {
				return cb(error);
			}

			var tokenInfo = {
				token: props.get('token'),
				tokenSecret: props.get('tokenSecret')
			};

			pushNotificationToUser(giraffeUserId, tokenInfo, message, options, function () {
				cb(); //Errors from this function are considered non-fatal.
			});
		});
	});
};


exports.postNotifications = function (messages, defaultMessage, options, cb) {
	var actorIds = Object.keys(messages);
	var skipEmpty = false;
	var callback = cb || function () {}; // cb is optional but we do need to push something into send

	if (actorIds.length === 0) {
		return callback();
	}

	if (typeof defaultMessage !== 'string') {
		defaultMessage = '';
		skipEmpty = true;
	}

	var postData = { notification: [], default_message: defaultMessage };
	var state = new mithril.core.State();

	resolveActors(state, actorIds, function (error, userMap) {
        state.close();

		if (error) {
			return callback(error);
		}

		for (var i = 0, len = actorIds.length; i < len; i += 1) {
			if (skipEmpty && !messages[actorIds[i]]) {
				continue;
			}

			var recipient = { receiver_id: userMap[actorIds[i]] };
			if (messages[actorIds[i]]) {
				recipient.message = messages[actorIds[i]];
			}

			postData.notification.push(recipient);
		}

		exports.send('post', { token: '', secret: '' }, '/Gameplatform/ApplicationNotificationMessageMulti', null, postData, callback);
	});
};


exports.pushNotifications = function (messages, options) { //messages = { actorId: 'message', .. }

	var actorIds = Object.keys(messages);
	if (actorIds.length === 0) {
		return;
	}

	var state = new mithril.core.State();

	resolveActors(state, actorIds, function (error, userMap) {
		if (error) {
			state.close();
			return;
		}

		var userIds = [];
		for (var i = 0, len = actorIds.length; i < len; i += 1) {
			userIds.push(userMap[actorIds[i]]);
		}

		exports.getUsersProperties(state, userIds, { load: ['token', 'tokenSecret'] }, function (error, props) {
			state.close();   // no more DB interactions from here

			if (error) {
				return;
			}

			async.forEachSeries(
				actorIds,
				function (actorId, callback) {
					var userId = userMap[actorId];

					var userProps = props[userId];
					if (!userProps) {
						mithril.core.logger.error('No user properties found for user', userId);
						return callback();
					}

					var message = messages[actorId];
					if (!message) {
						mithril.core.logger.error('No notification message for user', userId);
						return callback();
					}

					var tokenInfo = {
						token: userProps.get('token'),
						tokenSecret: userProps.get('tokenSecret')
					};

					pushNotificationToUser(userId, tokenInfo, message, options, function (error) {
						// ignore errors
						callback();
					});
				},
				function () {}
			);
		});
	});
};

