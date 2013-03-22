var mage = require('../../mage');
var logger = mage.core.logger.context('session');
var config = mage.core.config;
var timeCodeToSec = mage.core.helpers.timeCodeToSec;
var async = require('async');

var hostname = require('os').hostname();

var defaultLanguage = 'en';
var versionConfig;


// config:

exports.sessionTTL = null;     // session timeout in seconds
exports.keyLength = null;      // length of a session key in number of characters


exports.setup = function (state, cb) {
	var ttlCode   = config.get('module.session.ttl', '10m');
	var keyLength = config.get('module.session.keyLength', 16);

	var sessionTTL = timeCodeToSec(ttlCode);

	if (!sessionTTL || sessionTTL < 60) {
		var error = new Error('Unreasonably low session TTL: ' + ttlCode + ' (' + sessionTTL + ' seconds).');
		logger.emergency(error);
		return cb(error);
	}

	logger.debug('Session TTL set to', ttlCode, '(' + sessionTTL + ' seconds).');

	exports.keyLength = keyLength;
	exports.sessionTTL = sessionTTL;

	cb();
};


exports.setCurrentVersion = function (version, message) {
	// Once this function has been called, it will bounce every authentication request for a session
	// that was not created by a session module with this version. In this case and if provided,
	// we send back a friendly message to the player.

	versionConfig = {
		version: version,
		message: message
	};
};


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
		versionConfig ? versionConfig.version : undefined
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


// resolve(key) returns a session object to the callback for the given key, or false if not found

function resolve(state, key, cb) {
	logger.debug('Resolving session', key);

	if (!key) {
		return cb(null, false);
	}

	var info = key.split(':');

	if (info.length !== 2) {
		return cb(null, false);
	}

	var actorId = info[0];
	var sessionKey = info[1];

	// check DB for session

	var options = { optional: true, mediaTypes: ['application/json'] };

	state.archivist.get('session', { actorId: actorId }, options, function (error, data) {
		if (error) {
			return cb(error, false);
		}

		if (!data) {
			logger.debug('Session not found:', sessionKey);

			return cb(null, false);
		}

		// cast to strings for tomes compatibility

		if (('' + data.key) !== sessionKey) {
			logger.debug('Session key mismatch:', sessionKey, data.key);

			return cb(null, false);
		}

		if (versionConfig && data.version) {
			if (('' + data.version) !== ('' + versionConfig.version)) {
				var message = versionConfig.message;

				if (message && typeof message !== 'string') {
					message = message[data.language] || message[defaultLanguage] || null;
				}

				logger.debug('Auth message:', message);

				return cb(null, false, message);
			}
		}

		var session = Session.fromData(data);

		logger.debug('Session found in DB, pushing expiration time into the future');

		var expirationTime = parseInt(Date.now() / 1000, 10) + exports.sessionTTL;

		state.archivist.touch('session', { actorId: actorId }, expirationTime);

		cb(null, session);
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
