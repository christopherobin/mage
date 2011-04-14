var errors = {
	SESSION_NOTFOUND: { module: 'msg-server', code: 1000, type: 'restart', desc: 'Authentication error. Please restart.', log: { msg: 'Session not found.', method: 'error' } },
	SESSION_EXPECTED: { module: 'msg-server', code: 1001, type: 'restart', desc: 'Authentication error. Please restart.', log: { msg: 'Session expected.', method: 'error' } }
};




// prepare message handling

var userCommandCenter = require(mithril.paths.lib + '/userCommandCenter.js');


// startup messaging server

exports.start = function(httpServer)
{
	var io = require(mithril.paths.extlib + '/socket.io').listen(httpServer, { log: null });

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

			if (!state) state = new mithril.state.State(null, client, new mithril.datasources.DataSources);

			if (!state.session)
			{
				if (!msg.sessionId)
				{
					mithril.warn(errors.SESSION_EXPECTED, client);
				}
				else
				{
					mithril.sessions.resolve(state, msg.sessionId, function(error) {
						if (error)
						{
							mithril.warn(error, client);
						}
						else
						{
							userCommandCenter.execute(state, state.session.playerId, msg);
						}
					});
				}
			}
			else
			{
				userCommandCenter.execute(state, state.session.playerId, msg);
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

	mithril.logger.info('Message server waiting for commands.');
}

