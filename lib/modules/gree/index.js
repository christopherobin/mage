var mithril = require('../../mithril'),
	crypto = require('crypto'),
	async = require('async'),
	http = require('http'),
	OAuth = require('oauth').OAuth,
	querystring = require('querystring');

// Constants
var GREE_API_URL = 'http://os-sb.gree.jp/api/rest',
	GREE_GADGET_ROUTE = '/gree/gadget.xml',
	GREE_CALLBACK_ROUTE = '/gree/callback';

// OAuth object
var oauth = null;
function initOAuth(key, secret) {
	oauth = new OAuth('', '', key, secret, '1.0', null, 'HMAC-SHA1');
}

// Login handler
exports.onLogin = null; // function (state, actorId, userId, profile, cb)
exports.onNewPlayer = null; // function (state, userId, profile, cb)
exports.profileFields = [];

function getUserProperties(state, userId, options, cb) {
	var domain = {
		id: userId,
		key: 'gree/' + userId
	};

	mithril.core.LivePropertyMap.create(state, domain, options, cb);
}

function handleGadgetRequest(request, path, params, cb) {
	var clientHost = mithril.core.config.get('server.clientHost', {}),
		appId = mithril.core.config.get('module.gree.appId'),
		scheme = clientHost.protocol || 'http',
		expose = clientHost.expose || {},
		host = expose.host,
		port = expose.port || 80,
		callbackUrl = scheme + '://' + host + ':' + port + GREE_CALLBACK_ROUTE,
		xml = [
			'<?xml version="1.0" encoding="UTF-8"?>',
			'<Module>',
			'<ModulePrefs>',
			'<Link rel="event.addapp" href="'         + callbackUrl + '" method="GET" />',
			'<Link rel="event.suspendapp" href="'     + callbackUrl + '" method="GET" />',
			'<Link rel="event.resumeapp" href="'      + callbackUrl + '" method="GET" />',
			'<Link rel="event.upgradeuser" href="'    + callbackUrl + '" method="GET" />',
			'<Link rel="event.removeapp" href="'      + callbackUrl + '" method="GET" />',
			'<Link rel="gree.join_community" href="'  + callbackUrl + '" method="GET" />',
			'<Link rel="gree.leave_community" href="' + callbackUrl + '" method="GET" />',
			'</ModulePrefs>',
			'<Content view="touch" type="url" href="' + callbackUrl + '"/>',
			'</Module>'
		].join('\n');

	if (appId === params.opensocial_app_id) {
		cb(200, xml, {'Content-Type': 'application/xml'});
	} else {
		mithril.core.logger.error('Wrong appId! ' + appId);
		cb(404);
	}
}

function retrieveUserProfile(state, token, tokenSecret, cb) {
	var fields = exports.profileFields,
		params = {};

	if (fields instanceof Array && fields.length > 0) {
		params.fields = fields.join(',');
	}

	if (Object.keys(params).length) {
		params = '?' + querystring.stringify(params);
	}

	// FIXME: should use oauth.get() but it doesn't pass the extra parameters to the underlying _performSecureRequest() >.<
	oauth.getProtectedResource(GREE_API_URL + '/people/@me/@self' + params, 'GET', token, tokenSecret, function (error, data, response) {
	// oauth._performSecureRequest(token, tokenSecret, "GET", GREE_API_URL + '/people/@me/@self', params, "", null, function (error, data, response) {
		if (error) {
			return cb(error);
		}

		return cb(null, data.entry);
	});
}

// Called by our getSessionInsecure user command
// TODO: Will be called by the GREE callback when that works as per doc.
function didLogin(state, userId, token, tokenSecret, cb) {
	if (!userId || !token || !tokenSecret) {
		return state.error(null, 'Missing parameters', cb);
	}


	getUserProperties(state, userId, { load: ['actorId'] }, function (error, props) {
		if (error) {
			return cb(error);
		}

		var actorId = props.get('actorId');

		// update tokens if needed
		props.set('token', token);
		props.set('tokenSecret', tokenSecret);

		if (actorId) {
			// user exists
			return cb();
		}

		// Got a new player
		retrieveUserProfile(state, token, tokenSecret, function (error, profile) {
			if (error) {
				return cb(error);
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
}

// FIXME: remove this when getSessionInsecure goes away
exports.didLogin = didLogin;

function handleGREEEvent(request, path, params, cb) {
	var response = 'OK',
		extraHeaders = {};

	mithril.core.logger.debug('GREE event: ' + JSON.stringify({
		"HTTP headers": request.headers,
		"Params": params
	}, null, 2));

	// TODO: call didLogin() is this was a login event

	cb(200, response, extraHeaders);
}

exports.setup = function (state, cb) {
	var consumer = mithril.core.config.get('module.gree.consumer', {}),
		httpServer = mithril.core.msgServer.getHttpServer();

	if (!consumer || !consumer.key || !consumer.secret) {
		return state.error(null, 'gree module needs module.ggp.consumer.{key,secret} configuration entries', cb);
	}

	if (!httpServer) {
		return state.error(null, 'No HTTP server available', cb);
	}

	initOAuth(consumer.key, consumer.secret);
	httpServer.addRoute(GREE_GADGET_ROUTE, handleGadgetRequest);
	httpServer.addRoute(GREE_CALLBACK_ROUTE, handleGREEEvent);

	cb();
};

exports.getSession = function (state, userId, nonce, timestamp, hash, cb) {
	if (!userId || !nonce || !timestamp || !hash) {
		return state.error('auth', 'Parameter is missing in gree.getSession()', cb);
	}

	// TODO:
	// - trigger the onLogin(actorId, fields)
	// - cb(null, session)

	getUserProperties(state, userId, { load: ['actorId', 'token', 'tokenSecret'] }, function (error, props) {
		if (error) {
			return cb(error);
		}

		var actorId = props.get('actorId');
		if (!actorId) {
			return state.error('auth', 'Gree user has no associated actor id', cb);
		}

		var token = props.get('token'),
			tokenSecret = props.get('tokenSecret'),
			validHash = crypto.createHash('sha256').update('' + tokenSecret + nonce + timestamp + userId).digest('hex');

		// verify hash
		if (hash !== validHash) {
			return state.error('auth', 'Gree hash is not valid', cb);
		}

		// retrieve user profile from GREE
		retrieveUserProfile(state, token, tokenSecret, function (error, profile) {
			if (error) {
				return state.error(null, 'Couldn\'t retrieve GREE user profile: ' + JSON.stringify(error), cb);
			}

			// register the session
			mithril.session.register(state, actorId, function (error, session) {
				if (error) {
					return cb(error);
				}

				exports.onLogin(state, actorId, userId, profile, function (error) {
					if (error) {
						return cb(error);
					}

					cb(null, session.getFullKey(), { 'content-type': 'application/json; charset=utf-8' });
				});
			});
		});
	});
};
