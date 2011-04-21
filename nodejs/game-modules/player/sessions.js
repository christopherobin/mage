var errors = {
	SESSION_NOTFOUND: { module: 'session', code: 1000 }
};

exports.errors = errors;


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
	var len = 10;
	var key = '';
	var charCount = chars.length;

	while (len--)
	{
		key += chars[Math.floor(Math.random() * charCount)];
	}

	this.key = key;

	cb(null);
};


var sessions = {};


// resolve(key) returns a session object to the callback for the given key, or false if not found

exports.resolve = function(state, key, cb)
{
	var info = key.split(':');
	if (info.length != 2) return false;

	var playerId = info[0];
	var sessionKey = info[1];

	var session = sessions[playerId];

	if (session && session.key == sessionKey)
	{
		state.session = session;
		cb(null);
	}
	else
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

