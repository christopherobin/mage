function State(actorId, msg, session)
{
	// behaves like a transaction, and will send off everything that happened after commit() is called.

	this.actorId = actorId || null;

	if (!msg) msg = {};

	this.cmd = msg.cmd || null;
	this.p   = msg.p   || {};
	this.id  = msg.id  || null;
	this.data = {};		// may be used to pass data around between functions

	this.session = session || null;

	this.datasources = new mithril.core.datasources.DataSources(this);
	this.datasources.autoTransaction({ write: true, read: false });

	this.events = [];
	this.response = null;
	this.errorCode = null;
}


exports.State = State;


State.prototype.language = function()
{
	return this.session ? this.session.language : 'JA';
};


State.prototype.emit = function(actorId, path, data)
{
	this.events.push({ actorId: actorId, path: path, data: data });
};


State.prototype.emitToMany = function(filter, path, data, cb)
{
	var sql = 'SELECT actor FROM player';
	var params = [];
	var where = [];

	if (filter.actorIds)
	{
		where.push('actor IN (' + filter.actorIds.map(function() { return '?'; }).join(', ') + ')');
		params = params.concat(filter.actorIds);
	}

	if (filter.language)
	{
		where.push('language = ?');
		params.push(filter.language);
	}

	if (where.length > 0)
	{
		sql += ' WHERE ' + where.join(' AND ');
	}

	var _this = this;

	this.datasources.db.getMany(sql, params, null, function(error, players) {
		if (error) return cb(error);

		var len = players.length;
		for (var i=0; i < len; i++)
			_this.emit(players[i].actor, path, data);

		cb();
	});
};


State.prototype.error = function(userCode, logDetails, cb)
{
	if (logDetails)
		mithril.core.logger.error(logDetails);

	if (!userCode)
		userCode = 'server';

	this.errorCode = userCode;

	if (cb)
		cb(userCode);
};


State.prototype.userError = function(userCode, cb)
{
	// For errors that are caused by users. We don't need to log them per se, but we want a meaningful error message for the user.

	this.errorCode = userCode;

	if (cb)
		cb(userCode);
};


State.prototype.respond = function(response)
{
	this.response = response;
};


State.prototype._emitForOtherPlayer = function(actorId, path, data)
{
	mithril.player.sessions.find(this, actorId, function(error, sess) {
		if (!error && sess && sess.msgClient)
		{
			sess.msgClient.emit(path, data);
			sess.msgClient.send();
		}
	});
};


State.prototype.close = function()
{
	var _this = this;

	if (this.errorCode)
	{
		this.rollBack(function() { _this._cleanup(); });
	}
	else
		this.commit(function() { _this._cleanup(); });
};


State.prototype.commit = function(cb)
{
	var msgClient = (this.session && this.session.msgClient) ? this.session.msgClient : null;

	var n = this.events.length;
	for (var i=0; i < n; i++)
	{
		var evt = this.events[i];

		if (evt.actorId == this.actorId)
		{
			if (msgClient)
				msgClient.emit(evt.path, evt.data);
			else
			{
				// log the event
			}
		}
		else
			this._emitForOtherPlayer(evt.actorId, evt.path, evt.data);
	}

	if (this.id)
	{
		if (msgClient)
		{
			msgClient.respond(this.id, this.response);
		}
		else
		{
			// log the response
		}
	}

	if (msgClient)
		msgClient.send();

	this.events = [];
	this.response = null;

	this.datasources.commit(cb);
};


State.prototype.rollBack = function(cb)
{
	if (this.id)
	{
		var msgClient = (this.session && this.session.msgClient) ? this.session.msgClient : null;
		if (msgClient)
		{
			msgClient.respond(this.id, null, this.errorCode);

			if (msgClient)
				msgClient.send();
		}
		else
		{
			// log the response
		}
	}

	this.events = [];
	this.response = null;
	this.errorCode = null;

	this.datasources.rollBack(cb);
};


State.prototype._cleanup = function()
{
	this.datasources.close();

	this.datasources = null;
	this.session = null;
	this.p = null;
};

