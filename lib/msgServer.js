var errors = {
	SESSION_NOTFOUND: { module: 'msg-server', code: 1000, type: 'restart', desc: 'Authentication error. Please restart.', log: { msg: 'Session not found.', method: 'error' } },
	SESSION_EXPECTED: { module: 'msg-server', code: 1001, type: 'restart', desc: 'Authentication error. Please restart.', log: { msg: 'Session expected.', method: 'error' } }
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

			if (!state) state = new mithril.core.state.State(null, client, new mithril.core.datasources.DataSources);

			if (!state.session)
			{
				if (!msg.sessionId)
				{
					mithril.core.warn(errors.SESSION_EXPECTED, client);
				}
				else
				{
					mithril.core.sessions.resolve(state, msg.sessionId, function(error) {
						if (error)
						{
							mithril.core.warn(error, client);
						}
						else
						{
							mithril.core.userCommandCenter.execute(state, state.session.playerId, msg);
						}
					});
				}
			}
			else
			{
				mithril.core.userCommandCenter.execute(state, state.session.playerId, msg);
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

