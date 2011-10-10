var mithril   = require('./mithril'),
    async     = require('async'),
    State     = require(__dirname + '/state').State,
    MsgClient = require(__dirname + '/msgClient').MsgClient;


exports.io = null;


// message hooks

var messageHooks = {};
var reqMessageHookTypes = [];


exports.registerMessageHook = function (type, required, fn) {
	messageHooks[type] = fn;

	if (required) {
		// type becomes required

		if (reqMessageHookTypes.indexOf(type) === -1) {
			reqMessageHookTypes.push(type);
		}
	} else {
		// type became optional

		reqMessageHookTypes = reqMessageHookTypes.filter(function (reqType) {
			return reqType !== type;
		});
	}
};


// mithril's own message hooks:

exports.registerMessageHook('mithril.session', true, function (state, cfg, message, cb) {
	// check if a session key has been given

	if (!cfg.sessionId) {
		return state.error('expectedSession', 'No session key given.', cb);
	}

	// check if the session is already trusted

	if (state.session) {
		if (state.session.key !== cfg.sessionId) {
			return state.error('badSession', 'Existing known session key and given session key do not match.', cb);
		}

		return cb(null, message);
	}

	// resolve the session

	mithril.player.sessions.resolve(cfg.sessionId, function (error, session) {
		if (error || !session) {
			state.error('badSession', 'Could not resolve session: ' + cfg.sessionId, cb);
		}

		state.actorId = session.playerId;
		state.session = session;

		cb(null, message);
	});
});


exports.registerMessageHook('mithril.callback', false, function (state, cfg, message, cb) {
	// if a callback ID has been given, we store it on the state object, so we can use it in our response

	if (cfg.id) {
		state.callbackId = cfg.id;
	}

	cb(null, message);
});


// startup messaging server

function parseMessage(str) {
	var header = [], message;
	var headerDelimiterCharacter = '\t';

	try {
		var headerDelim = str.indexOf(headerDelimiterCharacter);
		if (headerDelim === -1) {
			message = str;
		} else {
			header = JSON.parse(str.substring(0, headerDelim));
			message = JSON.parse(str.substring(headerDelim + 1));
		}

		return [header, message];
	} catch (e) {
		return false;
	}
}


exports.start = function (httpServer) {
	var io = require('socket.io').listen(httpServer);

	io.set('log level', 1);

	io.sockets.on('connection', function (client) {
		mithril.core.logger.info('Message server accepted connection.');

		var msgClient = new MsgClient(client);
		var session = null;

		client.on('message', function (data) {
			mithril.core.logger.info('Message server received message: ' + data);

			// format: "[header array for wrappers] \t message data"

			data = parseMessage(data);
			if (!data) {
				mithril.core.logger.error('Parse error while parsing message.');
				return;
			}

			var header = data[0];
			var message = data[1];

			// create a state object

			var state = new State(null, null, msgClient);

			// allow any hooks to play with the message

			var usedHooks = [];

			async.reduce(
				header,
				message,
				function (prevMessage, entry, callback) {
					var hookType = entry.name;

					if (!hookType) {
						return callback();
					}

					var hook = messageHooks[hookType];

					if (!hook) {
						return state.error(null, 'Unknown hook type: ' + hookType, callback);
					}

					usedHooks.push(hookType);

					hook(state, entry, prevMessage, callback);
				},
				function (error, finalMessage) {
					if (error) {
						// parse error, or otherwise, so we cannot respond

						state.close();
					} else {
						// check if all required hooks have been met

						if (reqMessageHookTypes.length > 0) {
							var missingHookType = null;

							for (var i = 0, len = reqMessageHookTypes.length; i < len; i++) {
								var reqHookType = reqMessageHookTypes[i];

								if (usedHooks.indexOf(reqHookType) === -1) {
									missingHookType = reqHookType;
									break;
								}
							}

							if (missingHookType) {
								state.error(null, 'Message server received message that was not wrapped in hook type: ' + missingHookType);
								state.close();
								return;
							}
						}

						// decode the message

						try {
							finalMessage = JSON.parse(finalMessage);
						} catch (e) {
							state.error(null, 'Parse error in user command.');
							state.close();
							return;
						}

						if (!finalMessage) {
							state.error(null, 'Empty user command.');
							state.close();
							return;
						}

						// execute the command

						mithril.core.userCommandCenter.execute(state, finalMessage.cmd, finalMessage.p, function () {
							state.close();
						});
					}
				}
			);
		});


		client.on('disconnect', function () {
			mithril.core.logger.info('Message server considered connection gone.');

			if (msgClient) {
				msgClient.unbind();
			}
		});
	});


	mithril.core.logger.info('Message server waiting for commands.');

	exports.io = io;
};

