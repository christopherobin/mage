(function () {

	// message retrieval:

	var mithril = window.mithril;

	var io = mithril.io = {
		transports: {}
	};


	// default options, overridden through mithril.options.io

	var options = {
		timeOutRetry: 3000
	};


	var listeners = [];


	io.on = function (evt, fn, highPriority) {
		var group = highPriority ? 0 : 1;

		var handlers = listeners[group];
		if (!handlers) {
			handlers = listeners[group] = {};
		}

		if (handlers.hasOwnProperty(evt)) {
			handlers[evt].push(fn);
		} else {
			handlers[evt] = [fn];
		}
	};


	io.once = function (evt, fn, highPriority) {
		fn.once = true;
		io.on(evt, fn, highPriority);
	};


	function emit(evtPath, params) {
		var abort = false;


		var listenerFilter = function (fn) {
			if (abort) {
				return true;
			}

			// execute the handler

			var result;

			try {
				result = fn.call(null, evtPath, params);
			} catch (e) {
				console.warn('Caught error while emitting event ' + evtPath, e);
			}

			if (result === false) {
				abort = true;
			}

			if (fn.once) {
				delete fn.once;
				return false;
			}

			return true;
		};


		for (var i = 0, len = listeners.length; i < len; i++) {
			var path = evtPath.split('.');

			while (path.length > 0) {
				var subPath = path.join('.');

				var evtListeners = listeners[i][subPath];

				if (evtListeners) {
					listeners[i][subPath] = evtListeners.filter(listenerFilter);

					if (abort) {
						return;
					}
				}

				path.pop();
			}
		}
	}


	function emitEvents(events) {
		for (var i = 0, len = events.length; i < len; i++) {
			var evt = events[i];

			emit(evt[0], evt[1]);
		}
	}


	var expectedMsgId = null;
	var futurelog = {};


	function onMessages(messages) {
		console.log('Received messages', messages);

		// merge messages with futurelog

		for (var msgId in messages) {
			futurelog[msgId] = messages[msgId];
		}

		if (expectedMsgId === null) {
			// first event emission, so we look for the lowest msgId and start there (should be "1")

			for (msgId in futurelog) {
				msgId = msgId >>> 0;

				if (expectedMsgId === null || msgId < expectedMsgId) {
					expectedMsgId = msgId;
				}
			}

			if (expectedMsgId === null) {
				return;
			}
		}

		// emit events

		var eventpack;

		while ((eventpack = futurelog[expectedMsgId])) {
			delete futurelog[expectedMsgId];
			expectedMsgId++;

			emitEvents(eventpack);
		}
	}


	var current = null;	// url, data, [queryId], cb
	var cmdEndpoint;
	var queryId = 0;

	var sendCurrent = function () {
		console.warn('Command system not yet set up.');
	};


	function onCommandResponse(syserror, msg) {
		console.log(arguments);

		if (syserror) {
			// download error, possible cause for retry
/*
			if (syserror.reason === 'network') {
				// retry

				window.setTimeout(sendCurrent, options.timeOutRetry);
				return;
			}
*/
			if (current.cb) {
				current.cb(syserror);
			}

			return;
		}

		console.log('Received command response', msg);

		var cmd = current;
		current = null;

		// [error] or:
		// [null, response obj, events array] // where events may be left out

		var error    = msg[0];
		var response = msg[1];
		var events   = msg[2];

		if (response && cmd && cmd.cb) {
			if (events && !cmd.respondBeforeEvents) {
				emitEvents(events);
			}

			if (error) {
				cmd.cb(error);
			} else {
				cmd.cb(null, response);
			}

			if (events && cmd.respondBeforeEvents) {
				emitEvents(events);
			}
		} else if (events) {
			emitEvents(events);
		}
	}


	function setupEventSystem() {
		var Transport = io.transports['http-longpolling'];

		var endpoint = mithril.origin + '/msgstream?sessionKey=' + window.encodeURIComponent(mithril.session.key);

		if (!Transport) {
			console.warn('Event system could not start: No suitable transport found.');
			return;
		}

		var stream = new Transport();

		stream.start(endpoint, null, onMessages);
	}


	var cmdHooks = {};
	var cmdHeaderDelimiter = '\t';


	io.registerCommandHook = function (name, fn) {
		cmdHooks[name] = fn;
	};


	io.send = function (command, data, applyHooks, cb, respondBeforeEvents) {
		// format: JSON header [{"name": "msession", ...},{"name": "mauth1.0", ... }]

		command = mithril.packageName + '/' + command;

		var message = JSON.stringify(data);

		// apply any hooks

		var header = [];

		// if there is a callback ID, we add that as the first hook

		applyHooks = ['mithril.session', 'giraffe'];		// DEBUG! we currently auto-inject giraffe and session

		if (applyHooks) {
			for (var i = 0, len = applyHooks.length; i < len; i++) {
				var hookName = applyHooks[i];
				var hook = cmdHooks[hookName];

				if (!hook) {
					console.warn('Hook ' + hookName + ' required, but not registered.');
					return cb('badRequest');
				}

				var result = hook(message);

				if (result) {
					header.push(result.header);
					message = result.message;
				}
			}
		}

		data = JSON.stringify(header) + cmdHeaderDelimiter + message;

		current = {
			url: cmdEndpoint + command.replace(/\./g, '/'),
			data: data,
			queryId: ++queryId,
			cb: cb,
			respondBeforeEvents: respondBeforeEvents || false
		};

		sendCurrent();
	};


	function setupCommandSystem() {
		var HttpRequest = io.transports.http;
		var hr = new HttpRequest();


		// set up http client on io.start

		cmdEndpoint = mithril.origin;

		if (cmdEndpoint.substr(-1) !== '/') {
			cmdEndpoint += '/';
		}


		sendCurrent = function () {
			console.log('Sending command', current);

			if (current) {
				var params = {};

				if (current.queryId) {
					params.queryId = current.queryId;
				}

				hr.send('POST', current.url, params, current.data, null, onCommandResponse);
			}
		};
	}


	io.start = function () {
		// override options

		if (mithril.options && mithril.options.io) {
			var opts = mithril.options.io;

			for (var key in opts) {
				options[key] = opts[key];
			}
		}

		// check transport availability

		if (!io.transports) {
			console.warn('IO could not start: No transports found.');
			return;
		}

		// set up event system

		setupEventSystem();

		// set up command system

		setupCommandSystem();
	};

}());

