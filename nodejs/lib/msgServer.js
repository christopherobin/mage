var errors = {
	SESSION_NOTFOUND: { module: 'msg-server', code: 1000, type: 'restart', desc: 'Authentication error. Please restart.', log: { msg: 'Session not found.', method: 'error' } },
	SESSION_EXPECTED: { module: 'msg-server', code: 1001, type: 'restart', desc: 'Authentication error. Please restart.', log: { msg: 'Session expected.', method: 'error' } }
};


var State     = require(__dirname + '/state.js').State;
var MsgClient = require(__dirname + '/msgClient.js').MsgClient;


// startup messaging server

exports.start = function(httpServer)
{
	var io = require('socket.io').listen(httpServer, { log: null });

	io.on('connection', function(client) {
		// resolve session object

		var session = null;
		var resolvingSession = false;
		var msgQueue = [];


		function handleMessageQueue()
		{
			var msg = msgQueue.shift();

			if (msg)
				handleMessage(msg, handleMessageQueue);
		}


		function handleMessage(msg, cb)
		{
			if (!session || !msg.cmd) { if (cb) cb(); return; }

			var state = new State(session.playerId, msg, session);

			mithril.core.userCommandCenter.execute(state, function() {
				state.finish();
				state.cleanup();

				if (cb) cb();
			});
		}


		client.on('message', function(msg) {
			try { msg = JSON.parse(msg); } catch (e) { return; }
			if (!msg) return;


			// if session is not yet known, we must expect this to be revealed by the first message

			if (!session)
			{
				if (!resolvingSession && !msg.sessionId)
				{
					mithril.core.logger.debug(msg);
					mithril.core.warn(errors.SESSION_EXPECTED, client);
					return;
				}

				msgQueue.push(msg);

				if (!resolvingSession)
				{
					resolvingSession = true;

					mithril.player.sessions.resolve(msg.sessionId, function(error, result) {
						if (error)
							mithril.core.warn(error, client);
						else
						{
							session = result;

							if (session.msgClient)
								session.msgClient.rebind(client);
							else
								session.msgClient = new MsgClient(client);
						}

						resolvingSession = false;

						handleMessageQueue();
					});

					delete msg.sessionId;
				}
			}
			else
			{
				if (session.msgClient)
					session.msgClient.rebind(client);
				else
					session.msgClient = new MsgClient(client);

				handleMessage(msg);
			}
		});

		client.on('disconnect', function() {
			if (session && session.msgClient)
			{
				session.msgClient.unbind();
			}
		});
	});

	mithril.core.logger.info('Message server waiting for commands.');
}

