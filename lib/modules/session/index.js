var mage = require('../../mage');
var logger = mage.core.logger.context('session');
var config = mage.core.config;
var timeCodeToSec = mage.core.helpers.timeCodeToSec;
var async = require('async');
var semver = require('semver');
var State = mage.core.State;

var mmrpIdentity = mage.core.msgServer.comm.identity;

var defaultLanguage = 'en';


// config:

exports.sessionTTL = null;     // session timeout in seconds
exports.keyLength = null;      // length of a session key in number of characters


exports.setup = function (state, cb) {
	var ttlCode   = config.get(['module', 'session', 'ttl'], '10m');
	var keyLength = config.get(['module', 'session', 'keyLength'], 16);

	var sessionTTL = timeCodeToSec(ttlCode);

	if (!sessionTTL || sessionTTL < 60) {
		var error = new Error(
			'Unreasonably low session TTL: ' + ttlCode + ' (' + sessionTTL + ' seconds).'
		);

		logger.emergency(error);

		return cb(error);
	}

	logger.debug('Session TTL set to', ttlCode, '(' + sessionTTL + ' seconds).');

	exports.keyLength = keyLength;
	exports.sessionTTL = sessionTTL;

	try {
		mage.core.archivist.assertTopicAbilities('session', ['actorId'], ['set', 'get', 'del', 'touch']);
	} catch (err) {
		return state.error(null, err, cb);
	}

	cb();
};


// version management

/**
 * This function turns '0.1.2' into '0.1.x'
 *
 * @param   {string} version The version to base the range on
 * @returns {string}         The generated range string
 */

function createCompatibilityRange(version) {
	var chunks = version.split('.', 3);

	// replace the patch and trailing build information with 'x'
	chunks[2] = 'x';

	return chunks.join('.');
}

var badVersionMessage = {};
badVersionMessage[defaultLanguage] = 'A new version is out! Please restart.';

var appVersion = semver.valid(mage.rootPackage.version);
var appVersionRange;

if (appVersion) {
	appVersionRange = createCompatibilityRange(appVersion);
} else {
	logger.alert(
		'Invalid or missing version information in package.json, you should really look into this.',
		'Your package.json version field:', mage.rootPackage.version
	);
}


exports.setBadVersionMessage = function (message) {
	if (!message) {
		throw new Error('Cannot set an empty bad-version message');
	}

	switch (typeof message) {
	case 'object':
		badVersionMessage = message;
		break;
	case 'string':
		badVersionMessage = {};
		badVersionMessage[defaultLanguage] = message;
		break;
	default:
		throw new TypeError('Invalid bad-version message type (not string or object): ' + (typeof message));
	}
};


function sessionHasSupportedVersion(session) {
	if (!appVersionRange) {
		// this case has already been logged
		return true;
	}

	if (!session.version) {
		logger.error('Missing version information in session');
		return true;
	}

	var sessionVersion = semver.valid(session.version);

	if (!sessionVersion) {
		logger.error('Invalid version information in this session:', session.version);
		return true;
	}

	var isSupported = semver.satisfies(sessionVersion, appVersionRange);

	logger.verbose(
		'Tested session version', sessionVersion, 'against range', appVersionRange,
		'(valid: ' + (isSupported ? 'yes' : 'no') + ')'
	);

	return isSupported;
}


function getBadVersionMessage(language) {
	return badVersionMessage[language] || badVersionMessage[defaultLanguage];
}


/**
 * Session class
 *
 * @param {Object} [meta]       Key/value meta data object to store with the session
 * @param {string} actorId      An actor ID to associate with this session
 * @param {string} language     The language of the user
 * @param {string} key          The session key
 * @param {string} host         The mmrp identity associated with this session
 * @param {number} creationTime Time Unix timestamp of the creation time of this session
 * @param {string} version      The game version at the time of registration
 * @constructor
 */

function Session(meta, actorId, language, key, host, creationTime, version) {
	this.meta = meta || undefined;
	this.actorId = '' + actorId;
	this.language = language;
	this.key = key;
	this.host = host;
	this.creationTime = creationTime;
	this.version = version;
}


Session.create = function (meta, actorId, language) {
	// create a session key

	var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	var charCount = chars.length;
	var len = exports.keyLength;
	var key = '';

	while (len--) {
		key += chars[~~(Math.random() * charCount)];
	}

	return new Session(
		meta,
		actorId,
		language || defaultLanguage,
		key,
		mmrpIdentity,
		parseInt(Date.now() / 1000, 10),
		mage.rootPackage.version
	);
};


Session.fromData = function (data) {
	return new Session(
		data.meta,
		data.actorId,
		data.language,
		data.key,
		data.host,
		data.creationTime,
		data.version
	);
};


Session.prototype.getFullKey = function () {
	if (this.actorId && this.key) {
		return this.actorId + ':' + this.key;
	}

	return false;
};


// force expire a session

Session.prototype.expire = function (state) {
	state.archivist.del('session', { actorId: this.actorId });
};


// returns msgServer compatible addresses/hosts for actors

exports.getActorAddresses = function (state, actorIds, cb) {
	var addresses = [];
	var options = { optional: true, mediaTypes: ['application/json'] };

	async.forEachSeries(
		actorIds,
		function (actorId, callback) {
			if (!actorId) {
				return callback();
			}

			state.archivist.get('session', { actorId: actorId }, options, function (error, data) {
				if (error) {
					return callback(error);
				}

				if (data && data.key && data.host) {
					addresses.push({
						actorId: actorId,
						host: data.host,
						addrName: 'sess/' + actorId + ':' + data.key,
						language: data.language
					});
				}

				return callback();
			});
		},
		function (error) {
			if (error) {
				cb(error);
			} else {
				cb(null, addresses);
			}
		}
	);
};


function getActorSession(state, actorId, cb) {
	// check DB for session

	var options = { optional: true, mediaTypes: ['application/json'] };

	state.archivist.get('session', { actorId: actorId }, options, function (error, data) {
		if (error) {
			return cb(error);
		}

		if (!data) {
			logger.debug('No session found for actor:', actorId);

			return cb();
		}

		var session = Session.fromData(data);

		logger.debug('Session found for actor:', actorId);

		return cb(null, session);
	});
}


exports.getActorSession = getActorSession;


// resolve(key) returns a session object to the callback for the given key, or false if not found

function resolve(state, key, cb) {
	logger.debug('Resolving session', key);

	if (typeof key !== 'string') {
		logger.warning('Cannot resolve non-string session key:', key);

		return cb();
	}

	// find the last occurance of colon, and split actorId and session key there

	var index = key.lastIndexOf(':');
	if (index === -1) {
		logger.warning('Key does not appear to be for a session:', key);

		return cb();
	}

	var actorId = key.substring(0, index);
	var sessionKey = key.substring(index + 1);

	getActorSession(state, actorId, function (error, session) {
		if (error) {
			return cb(error);
		}

		if (!session) {
			return cb();
		}

		if (session.key !== sessionKey) {
			logger.debug('Session key mismatch:', sessionKey, session.key);

			return cb();
		}

		if (!sessionHasSupportedVersion(session)) {
			var message = getBadVersionMessage(session.language);

			logger.debug('Unsupported version, auth message:', message);

			return cb(null, undefined, message);
		}

		logger.debug('Session resolves successfully, pushing expiration time into the future');

		var expirationTime = parseInt(Date.now() / 1000, 10) + exports.sessionTTL;

		state.archivist.touch('session', { actorId: actorId }, expirationTime);

		return cb(null, session);
	});
}


exports.resolve = resolve;

function registerSession(state, session) {
	var expirationTime = parseInt(Date.now() / 1000, 10) + exports.sessionTTL;

	state.archivist.set('session', { actorId: session.actorId }, session, null, null, expirationTime);

	state.registerSession(session);
}


exports.register = function (state, actorId, language, meta, cb) {
	// load the language from the actor properties, and create a session object

	var session;

	try {
		session = Session.create(meta, actorId, language);

		registerSession(state, session);
	} catch (error) {
		return state.error(null, error, cb);
	}

	cb(null, session);
};


exports.reassignSession = function (state, fromActorId, toActorId, cb) {
	getActorSession(state, fromActorId, function (error, session) {
		if (error) {
			return cb(error);
		}

		if (!session) {
			return state.error(null, 'No session found for actor ' + fromActorId, cb);
		}

		session.expire(state);
		session.actorId = '' + toActorId;

		var newState = new State(toActorId);

		registerSession(newState, session);

		newState.close();

		cb(null, session);
	});
};


exports.activeSessionExists = function (state, actorId, cb) {
	var options = { optional: true, encodings: ['utf8'] };

	state.archivist.get('session', { actorId: actorId }, options, function (error, data) {
		if (error) {
			return cb(error);
		}

		return cb(null, data !== undefined);
	});
};


mage.core.cmd.registerMessageHook('mage.session', function (state, cfg, commands, cb) {
	// check if a session key has been given

	if (!cfg.key) {
		return state.error('auth', 'No session key given.', cb);
	}

	// resolve the session

	resolve(state, cfg.key, function (error, session, message) {
		if (error) {
			return cb(error);
		}

		if (!session) {
			// no session found
			// hooks are always auth (401)
			// as content we simply need to send the message back

			error = { message: message || '' };

			return state.error(error, null, cb);
		}

		state.registerSession(session);

		cb();
	});
});
