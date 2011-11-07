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


Session.prototype.touch = function (state) {
	this.lastTouchTime = mithril.core.time;

	var kvkey = generateKvKey(this.actorId);

	this.state.datasources.kv.touch(kvkey, Session.touchTTL);
};


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


// resolve(key) returns a session object to the callback for the given key, or false if not found

exports.resolve = function (key, cb) {
	mithril.core.logger.debug('Resolving session ' + key);

	var info = key.split(':');

	if (info.length === 2) {
		var actorId = info[0] >>> 0;
		var sessionKey = info[1];

		// check DB for session

		var state = new State();

		var kvkey = generateKvKey(actorId);

		state.datasources.kv.getOne(kvkey, false, null, function (err, result) {
			if (err) {
				cb(err, false);
			} else if (!result) {
				cb(null, false);
			} else {
				if (result.key !== sessionKey) {
					return cb(null, false);
				}

				// TODO: touch the session

				var session = new Session(actorId, result.language);

				session.key = sessionKey;
				session.creationTime = result.creationTime;

				mithril.core.logger.debug('Session found in DB.');

				cb(null, session);
			}

			state.close();
		});

		return;
	}

	cb(null, false);
};


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

