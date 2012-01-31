var mithril = require('../../mithril');
var State = mithril.core.State;
var cache = require('../../datasources/membase').getClient(mithril.core.config.get('data.kv'));

var hostname = require('os').hostname();

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

	mithril.core.logger.debug('Session TTL set to', ttlCode, '(' + sessionTTL + ' seconds).');

	exports.keyLength = keyLength;
	exports.sessionTTL = sessionTTL;

	cb();
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
	this.language = language || 'JA';
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
	key = 'sessdata/' + this.key + '/' + key;

	mithril.core.logger.debug('Setting ' + key);

	cache.set(key, value, ttl, cb);
};


Session.prototype.del = function (key, cb) {
	key = 'sessdata/' + this.key + '/' + key;

	cache.del(key, cb);
};


Session.prototype.get = function (key, cb) {
	key = 'sessdata/' + this.key + '/' + key;

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

	state.datasources.kv.set(kvkey, sessionData, exports.sessionTTL);
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

			result.push({ actorId: actorId, host: value.host, addrName: 'sess/' + actorId + ':' + value.key });
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
	mithril.core.logger.debug('Resolving session ' + key);

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

		var session = new Session(actorId, result.language);

		session.key = sessionKey;
		session.creationTime = result.creationTime;
		session.host = result.host;

		mithril.core.logger.debug('Session found in DB.');

		cb(null, session);
	});
}


exports.resolve = resolve;


exports.register = function (state, actorId, cb) {
	// load the language from the player table, and create a session object

	var sql = 'SELECT language FROM player WHERE actor = ?';
	var params = [actorId];

	state.datasources.db.getOne(sql, params, true, null, function (error, row) {
		if (error) {
			return cb(error);
		}

		var session = new Session(actorId, row.language);

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


mithril.core.cmd.registerMessageHook('mithril.session', function (state, memo, cfg, message, cb) {
	// check if a session key has been given

	if (!cfg.key) {
		return state.error('auth', 'No session key given.', cb);
	}

	// check if the session was already resolved in a previous run

	if (memo.session) {
		// TODO: only do this if cfg.key matches the session's own key
		// look into the "actorId:" being in there or not

		state.registerSession(memo.session);

		return cb(null, message);
	}

	// resolve the session

	resolve(cfg.key, function (error, session) {
		if (error || !session) {
			return state.error('auth', 'Could not resolve session: ' + cfg.key, cb);
		}

		state.registerSession(session);

		memo.session = session;

		cb(null, message);
	});
});

