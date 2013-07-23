var mage = require('../../mage');
var logger = mage.core.logger.context('session');
var config = mage.core.config;
var timeCodeToSec = mage.core.helpers.timeCodeToSec;
var async = require('async');
var semver = require('semver');

var hostname = require('os').hostname();

var defaultLanguage = 'en';
var badVersionMessage;


// config:

exports.sessionTTL = null;     // session timeout in seconds
exports.keyLength = null;      // length of a session key in number of characters


exports.setup = function (state, cb) {
	var ttlCode   = config.get(['module','session', 'ttl'], '10m');
	var keyLength = config.get(['module','session', 'keyLength'], 16);

	var sessionTTL = timeCodeToSec(ttlCode);

	if (!sessionTTL || sessionTTL < 60) {
		var errorMSG = 'Unreasonably low session TTL: ' + ttlCode + ' (' + sessionTTL + ' seconds).';
		logger.emergency(errorMSG);

		var error = new Error(errorMSG);
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


exports.setCurrentVersion = function () {
	logger.alert('setCurrentVersion is deprecated, use setBadVersionMessage to generate a custom message.');
};


exports.setBadVersionMessage = function (message) {
	badVersionMessage = message;
};


function sessionHasSupportedVersion(session) {
	var packageVersion = semver.valid(mage.rootPackage.version);
	var sessionVersion = semver.valid(session.version);

	if (!packageVersion || !sessionVersion) {
		logger.warning('Invalid or missing version information, you might want to look into this. package.json version:', mage.rootPackage.version + ', session.version:', session.version);
		return true;
	}

	var packageRange = '~' + packageVersion.substring(0, packageVersion.lastIndexOf('.'));

	return semver.satisfies(sessionVersion, packageRange);
}


function getBadVersionMessage(language) {
	var message = badVersionMessage;

	if (badVersionMessage && typeof badVersionMessage !== 'string') {
		message = badVersionMessage[language] || badVersionMessage[defaultLanguage];
	}

	return message;
}


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
		hostname,
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
			state.archivist.get('session', { actorId: actorId }, options, function (error, data) {
				if (error) {
					return callback(error);
				}

				if (data) {
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

	var info = key.split(':');

	if (info.length !== 2) {
		logger.warning('Key does not appear to be for a session:', key);

		return cb();
	}

	var actorId = info[0];
	var sessionKey = info[1];

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


exports.register = function (state, actorId, language, meta, cb) {
	// load the language from the actor properties, and create a session object

	var expirationTime = parseInt(Date.now() / 1000, 10) + exports.sessionTTL;
	var session;

	try {
		session = Session.create(meta, actorId, language);

		state.archivist.set('session', { actorId: actorId }, session, null, null, expirationTime);

		state.registerSession(session);
	} catch (error) {
		return state.error(null, error, cb);
	}

	cb(null, session);
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


mage.core.cmd.registerMessageHook('mage.session', function (state, cfg, messageData, cb) {
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
