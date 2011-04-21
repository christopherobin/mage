var errors = {
	SESSION_NOTFOUND: { module: 'msg-server', code: 1000, type: 'restart', desc: 'Authentication error. Please restart.', log: { msg: 'Session not found.', method: 'error' } },
	SESSION_EXPECTED: { module: 'msg-server', code: 1001, type: 'restart', desc: 'Authentication error. Please restart.', log: { msg: 'Session expected.', method: 'error' } }
};


function MsgClient(client)
{
	this.client = client;
	this.response = null;
	this.events = [];
	this.errors = [];
	this.queryId = null;
}


MsgClient.prototype.error = function(code)
{
	this.errors.push(code);
};


MsgClient.prototype.respond = function(response)
{
	this.response = response;
};


MsgClient.prototype.emit = function(data)
{
	this.events.push(data);
};


MsgClient.prototype.finish = function()
{
	var o = { events: this.events, response: this.response };

	if (this.queryId)
	{
		o.id = this.queryId;
		this.queryId = null;
	}

	if (this.errors.length > 0)
	{
		o.errors = this.errors;
	}

	this.client.send(JSON.stringify(o));

	this.response = null;
	this.events = [];
	this.errors = [];
};


MsgClient.prototype.cleanup = function()
{
	this.client = null;
	this.response = null;
	this.events = [];
	this.errors = [];
};


// startup messaging server

exports.start = function(httpServer)
{
	var io = require(mithril.core.paths.extlib + '/socket.io').listen(httpServer, { log: null });

	io.on('connection', function(client) {
		// resolve session object

		var state = null;

		client.on('message', function(msg) {
			try
			{
				msg = JSON.parse(msg);
			}
			catch (e)
			{
				return;
			}

			if (!msg) return;


			// if session is not yet known, we must expect this to be revealed by the first message

			if (!state) state = new mithril.core.state.State(null, new MsgClient(client), new mithril.core.datasources.DataSources);

			// check if the message has been tagged with a query ID.

			state.msgClient.queryId = msg.id;	// can be undefined

			if (!state.session)
			{
				if (!msg.sessionId)
				{
					mithril.core.warn(errors.SESSION_EXPECTED, client);
				}
				else
				{
					mithril.player.sessions.resolve(state, msg.sessionId, function(error) {
						if (error)
						{
							mithril.core.warn(error, client);
						}
						else
						{
							if (msg.cmd)
							{
								mithril.core.userCommandCenter.execute(state, state.session.playerId, msg, function() { state.msgClient.finish(); });
							}
						}
					});
				}
			}
			else
			{
				if (msg.cmd)
				{
					mithril.core.userCommandCenter.execute(state, state.session.playerId, msg, function() { state.msgClient.finish(); });
				}
			}
		});

		client.on('disconnect', function() {
			if (state)
			{
				state.cleanup();
				state = null;
			}
		});
	});

	mithril.core.logger.info('Message server waiting for commands.');
}

