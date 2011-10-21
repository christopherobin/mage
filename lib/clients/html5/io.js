(function () {

	// Mithril non-custom error codes:
	//   "server": an internal error happened. Advise: error is logged by game provider.
	//   "badSession": the session was not accepted by the server. Advise: player restarts game (re-login).
	//   "expectedSession": a session was expected, but not sent by the client. Advise: this should never happen, as we send it all the time now.

	var mithril = window.mithril;

	var mio = mithril.io = {
		socket: null,
		headerDelimiter: '\t'
	};


	var eventListeners = [{}, {}];
	var queries = {};
	var queryId = 0;


	// default error handler, should be overridden!

	mio.handleError = function (error) {
		window.alert(error);
	};


	// default hook for session support

	mio.sendHooks = [function (message) {
		return {
			header: { name: 'mithril.session', sessionId: mithril.sessionId },
			message: message
		};
	}];


	// message handlers (events, responses)

	function receivedEvent(evt) {
		var path = evt[0];
		var data = evt[1];
		var id   = evt[2];

		var emptyFilter = function (elm) {
			return elm;
		};

		var result = null;

		var len = eventListeners.length;

		for (var i = 0; i < len; i++) {
			var pathElements = path.split('.');

			do {
				var listenerPath = pathElements.join('.');

				var listeners = eventListeners[i][listenerPath];

				if (listeners) {
					var dropped = false;
					var n = listeners.length;

					for (var j = 0; j < n; j++) {
						var listener = listeners[j];

						result = listener.cb(path, data);

						if (listener.once && result !== false) {
							delete listener.cb;
							delete listeners[j];
							dropped = true;
						}
					}

					if (dropped) {
						eventListeners[i][listenerPath] = listeners.filter(emptyFilter);
					}
				}

				pathElements.pop();

			} while (pathElements.length);
		}
	}


	function receivedQueryResult(result, isAfterEvents) {
		var id = result[0];
		var response = result[1];
		var error = result[2] || null;

		if (error === 'expectedSession') {
			return;
		}

		var query = queries[id];

		if (query && query.onAfterEvents === isAfterEvents) {
			delete queries[id];

			console.log('Received query result', result, isAfterEvents);

			var errorToHandle = query.cb(error, response);
			if (errorToHandle) {
				mio.handleError(error);
			}

			delete query.cb;
		}
	}


	mio.send = function (command, parameters, cb, onBeforeEvents) {
		var obj = {
			cmd: command,
			p: parameters
		};

		var callbackId;

		if (cb) {
			callbackId = ++queryId;

			queries[callbackId] = {
				cb: cb,
				onAfterEvents: !onBeforeEvents
			};
		}

		// format: JSON header [{"name": "msession", ...},{"name": "mauth1.0", ... }]

		var message = JSON.stringify(obj);

		// apply any hooks

		var header = [];

		// if there is a callback ID, we add that as the first hook

		if (callbackId) {
			header.push({ name: 'mithril.callback', id: callbackId });
		}

		if (mio.sendHooks) {
			for (var i = 0, len = mio.sendHooks.length; i < len; i++) {
				var hook = mio.sendHooks[i];

				var result = hook(message);

				if (result) {
					header.push(result.header);
					message = result.message;
				}
			}
		}

		// now the internal hook for adding a session key

		var data = JSON.stringify(header) + mio.headerDelimiter + message;

		console.log('Sending', data);

		mio.socket.send(data);
	};


	// function that starts up the mio connection

	mio.start = function (cb) {
		var cfg = mithril.config;

		var defaultCfgSocketIo = {
			'transports': ['xhr-polling'],
			'try multiple transports': true,
			'connect timeout': 5000,
			reconnect: true
		};

		mio.socket = window.io.connect(cfg.origin, cfg.socketio || defaultCfgSocketIo);


		// on connect, call the callback that was passed to start()

		mio.socket.on('connect', function () {
			if (cb) {
				cb();
				cb = null;
			}
		});


		// handle messages

		mio.socket.on('message', function (result) {
			console.log('Received message:', result);

			try {
				result = JSON.parse(result);
			} catch (e) {
				return;
			}

			var responses = result.responses;
			var events = result.events;
			var i, len;

			if (responses) {
				for (i = 0, len = responses.length; i < len; i++) {
					receivedQueryResult(responses[i], false);
				}
			}

			if (events) {
				for (i = 0, len = events.length; i < len; i++) {
					receivedEvent(events[i]);
				}
			}

			if (responses) {
				for (i = 0, len = responses.length; i < len; i++) {
					receivedQueryResult(responses[i], true);
				}
			}
		});
	};


	mio.on = function (path, cb, priority) {
		var group = priority ? 0 : 1;

		if (!(path in eventListeners[group])) {
			eventListeners[group][path] = [];
		}

		eventListeners[group][path].push({ cb: cb });
	};


	mio.once = function (path, cb, priority) {
		var group = priority ? 0 : 1;

		if (!(path in eventListeners[group])) {
			eventListeners[group][path] = [];
		}

		var listener = {
			cb: cb,
			once: true
		};

		eventListeners[group][path].push(listener);
	};


	mio.removeListener = function (path, cb, priority) {
		var group = priority ? 0 : 1;

		var listeners = eventListeners[group][path];
		if (listeners) {
			listeners = listeners.filter(function (listener) {
				return listener.cb !== cb;
			});

			if (listeners.length > 0) {
				eventListeners[group][path] = listeners;
			} else {
				delete eventListeners[group][path];
			}
		}
	};

}());
