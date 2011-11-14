var mithril = require('../../mithril');
var State = mithril.core.State;
var cache = require('../../datasources/membase').getClient(mithril.getConfig('data.kv'));

var hostname = require('os').hostname();


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


Session.touchTTL = 600;		// in seconds
Session.keyLength = 16;

/*
Session.prototype.touch = function (cb) {
	var kvkey = generateKvKey(this.actorId);

	this.state.datasources.kv.touch(kvkey, Session.touchTTL, cb);
};
*/

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
	var len = Session.keyLength;
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

	state.datasources.kv.set(kvkey, sessionData, Session.touchTTL, cb);
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
	state.datasources.kv.getOne(key, false, null, function (error, result) {
		if (error) {
			cb(error);
		} else if (!result) {
			cb(null, result);
		} else {
			state.datasources.kv.touch(key, Session.touchTTL, function (error) {
				if (error) {
					return cb(error);
				}

				cb(null, result);
			});
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

	var state = new State();

	var kvkey = generateKvKey(actorId);

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

		session.register(state, function (error) {
			if (error) {
				cb(error);
			} else {
				cb(null, session);
			}
		});
	});
};


mithril.core.msgServer.registerMessageHook('mithril.session', function (state, cfg, message, cb) {
	// check if a session key has been given

	if (!cfg.key) {
		return state.error('auth', 'No session key given.', cb);
	}

	// check if the session is already trusted

	if (state.session) {
		if (state.session.getFullKey() !== cfg.key) {
			return state.error('auth', 'Existing known session key and given session key do not match.', cb);
		}

		return cb(null, message);
	}

	// resolve the session

	resolve(cfg.key, function (error, session) {
		if (error || !session) {
			return state.error('auth', 'Could not resolve session: ' + cfg.key, cb);
		}

		state.actorId = session.actorId;
		state.session = session;

		cb(null, message);
	});
});
