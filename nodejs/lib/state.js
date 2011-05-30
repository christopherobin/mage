function State(actorId, msg, session)
{
	this.ERR_RESTART  = 1;
	this.ERR_INTERNAL = 100;

	// behaves like a transaction, and will send off everything that happened after commit() is called.

	this.actorId = actorId || null;

	if (!msg) msg = {};

	this.cmd = msg.cmd || null;
	this.p   = msg.p   || {};
	this.id  = msg.id  || null;

	this.session = session || null;

	this.datasources = new mithril.core.datasources.DataSources(this);
	this.datasources.autoTransaction({ write: true, read: false });

	this.events = [];
	this.response = null;
	this.errors = [];
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


State.prototype.error = function(userCode, logDetails, cb)
{
	if (logDetails)
		mithril.core.logger.error(logDetails);

	if (!userCode)
		userCode = this.ERR_INTERNAL;

	this.errors.push(userCode);

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

	if (this.errors.length > 0)
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
			msgClient.respond(this.id, null, this.errors);

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
	this.errors = [];

	this.datasources.rollBack(cb);
};


State.prototype._cleanup = function()
{
	this.datasources.close();

	this.datasources = null;
	this.session = null;
	this.p = null;
};

