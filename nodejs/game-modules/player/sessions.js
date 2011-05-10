var errors = {
	SESSION_NOTFOUND:     { module: 'session', code: 1000 },
	SESSION_REGISTRATION: { module: 'session', code: 1001 }
};

exports.errors = errors;


var State = require(mithril.core.paths.lib + '/state.js').State;


function Session(playerId)
{
	this.playerId = playerId;
	this.key = null;
	this.creationTime = mithril.core.time;
	this.lastTouchTime = this.creationTime;
}


Session.prototype.touch = function()
{
	this.lastTouchTime = mithril.core.time;
};


Session.prototype.getFullKey = function()
{
	if (this.key && this.playerId)
	{
		return this.playerId + ':' + this.key;
	}

	return false;
};


Session.prototype.register = function(cb)
{
	const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	const charCount = chars.length;
	var len = 10;
	var key = '';

	while (len--)
	{
		key += chars[Math.floor(Math.random() * charCount)];
	}

	this.key = key;


	// register session to DB

	var state = new State;
	var sql = 'REPLACE INTO player_session VALUES (?, ?, ?, ?, ?)';
	var params = [this.playerId, key, this.creationTime, this.lastTouchTime, 'active'];

	state.datasources.db.exec(sql, params, errors.SESSION_REGISTRATION, function(err, result) {
		if (err)
			cb(err);
		else
			cb(null);

		state.cleanup();
	});
};


var sessions = {};


// resolve(key) returns a session object to the callback for the given key, or false if not found

exports.resolve = function(key, cb)
{
	mithril.core.logger.debug('Resolving session ' + key);

	var info = key.split(':');
	if (info.length == 2)
	{
		var playerId = parseInt(info[0]);
		var sessionKey = info[1];

		// check locally

		var session = sessions[playerId];

		if (session && session.key == sessionKey)
		{
			mithril.core.logger.debug('Session found in local cache.');

			cb(null, session);
			return;
		}

		// session not found locally, check DB

		var state = new State;
		var query = 'SELECT creationTime, lastTouchTime FROM player_session WHERE player = ? AND sessionId = ?';
		var params = [playerId, sessionKey];

		state.datasources.db.getOne(query, params, true, errors.SESSION_NOTFOUND, function(err, result) {
			if (err)
				cb(err);
			else
			{
				var session = new Session(playerId);
				session.key = sessionKey;
				session.creationTime = result.creationTime;
				sessions[playerId] = session;

				mithril.core.logger.debug('Session found in DB. Registered in local cache.');

				cb(null, session);
			}

			state.cleanup();
		});

		return;
	}

	cb(errors.SESSION_NOTFOUND);
};


// find(playerId) returns a session object to the callback for the given player, or false if not found

exports.find = function(playerId, cb)
{
	if (playerId in sessions)
	{
		cb(null, sessions[playerId]);
	}
	else
		cb(errors.SESSION_NOTFOUND);
};


exports.register = function(playerId, cb)
{
	// generate a key

	var session = new Session(playerId);

	session.register(function(error) {
		if (!error)
		{
			sessions[playerId] = session;
			cb(null, session);
		}
		else
			cb(error);
	});
};

