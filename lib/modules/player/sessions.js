var State = mithril.core.State;


function Session(playerId, language)
{
	this.playerId = playerId;
	this.language = language || 'JA';
	this.key = null;
	this.creationTime = mithril.core.time;
	this.lastTouchTime = this.creationTime;
}


Session.prototype.touch = function()
{
	this.lastTouchTime = mithril.core.time;

	// TODO: push this timestamp to DB
};


Session.prototype.getFullKey = function()
{
	if (this.key && this.playerId)
	{
		return this.playerId + ':' + this.key;
	}

	return false;
};


Session.prototype.register = function(state, cb)
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

	var sql = 'REPLACE INTO player_session VALUES (?, ?, ?, ?, ?)';
	var params = [this.playerId, key, this.creationTime, this.lastTouchTime, 'active'];

	state.datasources.db.exec(sql, params, null, function(err, result) {
		if (err)
			cb(err);
		else
			cb();
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
		var playerId = ~~info[0];
		var sessionKey = info[1];

		// check locally

		var session = sessions[playerId];

		if (session && session.key == sessionKey)
		{
			mithril.core.logger.debug('Session found in local cache.');

			return cb(null, session);
		}

		// session not found locally, check DB

		var state = new State;
		var query = 'SELECT p.language, s.creationTime, s.lastTouchTime FROM player_session AS s JOIN player AS p ON p.actor = s.player WHERE s.player = ? AND s.sessionId = ?';
		var params = [playerId, sessionKey];

		state.datasources.db.getOne(query, params, false, null, function(err, result) {
			if (err)
			{
				cb(err, false);
			}
			else if (!result)
			{
				cb(null, false);
			}
			else
			{
				var session = new Session(playerId, result.language);
				session.key = sessionKey;
				session.creationTime = result.creationTime;
				session.lastTouchTime = result.lastTouchTime;
				sessions[playerId] = session;

				mithril.core.logger.debug('Session found in DB. Registered in local cache.');

				cb(null, session);
			}

			state.close();
		});

		return;
	}

	cb(null, false);
};


// find(playerId) returns a session object to the callback for the given player, or false if not found

exports.find = function(state, playerId, cb)
{
	// TODO: add DB check if session not found

	if (playerId in sessions)
	{
		cb(null, sessions[playerId]);
	}
	else
		cb(null, false);
};


exports.register = function(state, playerId, cb)
{
	var session = new Session(playerId);

	session.register(state, function(error) {
		if (!error)
		{
			sessions[playerId] = session;
			cb(null, session);
		}
		else
			cb(error);
	});
};

