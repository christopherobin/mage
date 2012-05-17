var mithril = require('../../mithril');
var State = mithril.core.State;
var cache = require('../../datasources/membase').getClient(mithril.core.config.get('data.kv'));
var logger = mithril.core.logger;

var hostname = require('os').hostname();

var defaultLanguage = 'EN';
var versionConfig;


// config:

exports.sessionTTL = null;     // session timeout in seconds
exports.keyLength = null;      // length of a session key in number of characters


exports.setup = function (state, cb) {
	var ttlCode   = mithril.core.config.get('module.session.ttl', '10m');
	var keyLength = mithril.core.config.get('module.session.keyLength', 16);

	var sessionTTL = mithril.core.helpers.timeCodeToSec(ttlCode);

	if (!sessionTTL || sessionTTL < 60) {
		return mithril.fatalError('Unreasonably low session TTL', ttlCode, '(' + sessionTTL + ' seconds).');
	}

	logger.debug('Session TTL set to', ttlCode, '(' + sessionTTL + ' seconds).');

	exports.keyLength = keyLength;
	exports.sessionTTL = sessionTTL;

	cb();
};


var versionConfig;

exports.setCurrentVersion = function (version, message) {
	// Once this function has been called, it will bounce every authentication request for a session
	// that was not created by a session module with this version. In this case and if provided,
	// we send back a friendly message to the player.

	versionConfig = {
		version: version,
		message: message
	};
};


function generateKvKey() {
	var key = 'session';

	for (var i = 0, len = arguments.length; i < len; i++) {
		key += '/' + arguments[i];
	}

	return key;
}


function Session(actorId, language) {
	this.actorId = actorId >>> 0;
	this.language = language || defaultLanguage;
	this.key = null;
	this.host = null;
	this.creationTime = mithril.core.time;
}


Session.prototype.getFullKey = function () {
	if (this.key && this.actorId) {
		return this.actorId + ':' + this.key;
	}

	return false;
};


// set/del/get for session data
// this data will not survive, so use only for limited TTLs
// callbacks are optional

Session.prototype.set = function (key, ttl, value, cb) {
	var sessionKey = this.getFullKey();
	if (!sessionKey) {
		if (cb) {
			cb();
		}
		return;
	}

	key = 'sessdata/' + sessionKey + '/' + key;

	logger.debug('Setting', key, 'for session of actor', this.actorId);

	cache.set(key, value, ttl, cb);
};


Session.prototype.del = function (key, cb) {
	var sessionKey = this.getFullKey();
	if (!sessionKey) {
		if (cb) {
			cb();
		}
		return;
	}

	key = 'sessdata/' + sessionKey + '/' + key;

	logger.debug('Deleting', key, 'for session of actor', this.actorId);

	cache.del(key, cb);
};


Session.prototype.get = function (key, cb) {
	var sessionKey = this.getFullKey();
	if (!sessionKey) {
		if (cb) {
			cb();
		}
		return;
	}

	key = 'sessdata/' + sessionKey + '/' + key;

	cache.get(key, cb);
};


Session.prototype.register = function (state, cb) {
	// determine hostname

	var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	var charCount = chars.length;
	var len = exports.keyLength;
	var key = '';

	while (len--) {
		key += chars[~~(Math.random() * charCount)];
	}

	this.key = key;
	this.host = hostname;


	// register session to DB

	var kvkey = generateKvKey(this.actorId);

	var sessionData = {
		key: this.key,
		language: this.language,
		creationTime: this.creationTime,
		host: this.host
	};

	if (versionConfig) {
		sessionData.version = versionConfig.version;
	}

	state.datasources.kv.set(kvkey, sessionData, exports.sessionTTL);
	cb();
};

// force expire a session
Session.prototype.expire = function (state, cb) {
	var kvKey = generateKvKey(this.actorId);
	state.datasources.kv.del(kvKey);
	cb();
};

// returns msgServer compatible addresses/hosts for actors

exports.getActorAddresses = function (state, actorIds, cb) {
	var keys = [];
	var actorMap = {};

	for (var i = 0, len = actorIds.length; i < len; i++) {
		var actorId = actorIds[i];
		var key = generateKvKey(actorId);

		keys.push(key);
		actorMap[key] = actorId;
	}

	state.datasources.kv.getMany(keys, null, function (error, data) {
		if (error) {
			return cb(error);
		}

		var result = [];

		for (var key in data) {
			var value = data[key];
			var actorId = actorMap[key];

			result.push({ actorId: actorId, host: value.host, addrName: 'sess/' + actorId + ':' + value.key, language: value.language });
		}

		cb(null, result);
	});
};


function getAndTouch(state, key, cb) {
	// TODO: implement the "gat" (get and touch) API, and replace this function with: cache.command('gat' etc)
	// "gat" is currently not available in the ascii protocol, hence node-memcached cannot do it.

	state.datasources.kv.getOne(key, false, null, function (error, result) {
		if (error) {
			cb(error);
		} else if (!result) {
			cb(null, result);
		} else {
			state.datasources.kv.touch(key, exports.sessionTTL);

			cb(null, result);
		}
	});
}


// resolve(key) returns a session object to the callback for the given key, or false if not found

function resolve(key, cb) {
	logger.debug('Resolving session', key);

	if (!key) {
		return cb(null, false);
	}

	var info = key.split(':');

	if (info.length !== 2) {
		return cb(null, false);
	}

	var actorId = info[0] >>> 0;
	var sessionKey = info[1];

	// check DB for session

	// TODO: if we use cache (see "gat" API comment above), instead of a full blown datasource, we can avoid creating a state object here

	var kvkey = generateKvKey(actorId);

	var state = new State();

	getAndTouch(state, kvkey, function (error, result) {
		state.close();

		if (error) {
			return cb(error, false);
		}

		if (!result) {
			return cb(null, false);
		}

		if (result.key !== sessionKey) {
			return cb(null, false);
		}

		if (versionConfig && result.version !== versionConfig.version) {
			var message = versionConfig.message;

			if (message && typeof message !== 'string') {
				message = message[result.language] || message[defaultLanguage] || null;
			}

			mithril.core.logger.debug('Auth message:', message);

			return cb(null, false, message);
		}

		var session = new Session(actorId, result.language);

		session.key = sessionKey;
		session.creationTime = result.creationTime;
		session.host = result.host;
		session.version = result.version;

		logger.debug('Session found in DB.');

		cb(null, session);
	});
}


exports.resolve = resolve;


exports.register = function (state, actorId, cb) {
	// load the language from the actor properties, and create a session object

	mithril.actor.getActorProperties(state, actorId, { load: ['language'] }, function (error, props) {
		if (error) {
			return cb(error);
		}

		var session = new Session(actorId, props.get('language') || defaultLanguage);

		state.actorId = session.actorId;
		state.session = session;

		session.register(state, function (error) {
			if (error) {
				cb(error);
			} else {
				cb(null, session);
			}
		});
	});
};

mithril.core.cmd.registerMessageHook('mithril.session', function (state, cfg, messageData, cb) {
	// check if a session key has been given

	if (!cfg.key) {
		return state.error('auth', 'No session key given.', cb);
	}

	// resolve the session

	resolve(cfg.key, function (error, session, message) {
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

