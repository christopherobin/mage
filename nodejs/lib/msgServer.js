var mithril = require('../mithril.js'),
    State     = require(__dirname + '/state.js').State,
    MsgClient = require(__dirname + '/msgClient.js').MsgClient;


exports.io = null;


// startup messaging server

exports.start = function(httpServer)
{
	function sessionlessError(client, msg, error)
	{
		var msgClient = new MsgClient(client);
		msgClient.respond(msg.id || null, null, error);
		msgClient.send();
		msgClient.cleanup();
	}


	var io = require('socket.io').listen(httpServer);
	io.set('log level', 1);

	io.sockets.on('connection', function(client) {
		// resolve session object

		mithril.core.logger.info('Message server accepted connection.');

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
				state.close();

				if (cb) cb();
			});
		}


		client.on('message', function(msg) {

			mithril.core.logger.info('Message server received message: ' + msg);

			try { msg = JSON.parse(msg); } catch (e) { return; }
			if (!msg) return;

			// if session is not yet known, we must expect this to be revealed by the first message

			if (!session)
			{
				if (!resolvingSession && !msg.sessionId)
				{
					mithril.core.logger.info('Message server received message without session ID, while not resolving a session.');

					sessionlessError(client, msg, 'expectedSession');
					return;
				}

				msgQueue.push(msg);

				if (!resolvingSession)
				{
					resolvingSession = true;

					mithril.player.sessions.resolve(msg.sessionId, function(error, result) {
						if (error || !result)
						{
							mithril.core.logger.info('Could not resolve session: ' + msg.sessionId);
							sessionlessError(client, msg, 'badSession');
							msgQueue = [];
							resolvingSession = false;
						}
						else
						{
							session = result;

							if (session.msgClient)
								session.msgClient.rebind(client);
							else
								session.msgClient = new MsgClient(client);

							resolvingSession = false;

							handleMessageQueue();
						}
					});
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

	exports.io = io;
}

