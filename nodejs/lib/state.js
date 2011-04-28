function State(actorId, msg, session)
{
	// behaves like a transaction, and will send off everything that happened after commit() is called.

	this.actorId = actorId;

	if (!msg) msg = {};

	this.cmd = msg.cmd || null;
	this.p   = msg.p   || {};
	this.id  = msg.id  || null;

	this.session = session || null;

	this.datasources = new mithril.core.datasources.DataSources;

	this.events = [];
	this.response = null;
	this.errors = [];
}


exports.State = State;


State.prototype.emit = function(actorId, path, data)
{
	this.events.push({ actorId: actorId, path: path, data: data });
};


State.prototype.error = function(error)
{
	this.errors.push(error);
};


State.prototype.respond = function(response)
{
	this.response = response;
};


State.prototype._emitForOtherActor = function(actorId, path, data)
{
	mithril.player.session.find(actorId, function(error, sess) {
		if (!error && sess && sess.msgClient)
		{
			sess.msgClient.emit(path, data);
			sess.msgClient.send();
		}
	});
};


State.prototype.finish = function()
{
	if (this.errors.length > 0)
	{
		this.rollBack();
	}
	else
		this.commit();
};


State.prototype.commit = function()
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
			var errors = (this.errors.length > 0) ? this.errors : null;
			msgClient.respond(this.id, this.response, errors);
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
	this.errors = [];
};


State.prototype.rollBack = function()
{
	if (this.id)
	{
		var msgClient = (this.session && this.session.msgClient) ? this.session.msgClient : null;
		if (msgClient)
		{
			var errors = (this.errors.length > 0) ? this.errors : null;
			msgClient.respond(this.id, this.response, errors);

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
};


State.prototype.cleanup = function()
{
	this.ds = null;
	this.session = null;
	this.p = null;
};

