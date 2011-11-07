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


	function emit(evt, args) {
		for (var i = 0, len = listeners.length; i < len; i++) {
			var evtListeners = listeners[i][evt];

			if (evtListeners) {
				for (var j = 0, jlen = evtListeners.length; j < jlen; j++) {
					try {
						evtListeners[j].apply(null, args);
					} catch (e) {
						console.warn('Caught exception', e);
					}
				}
			}
		}
	}


	function emitEvents(events, group) {
		for (var i = 0, len = events.length; i < len; i++) {
			var evt = events[i];

			emit(evt[0], evt[1]);
		}
	}


	function onMessages(messages) {
		console.log('Received messages', messages);

		for (var i = 0, len = messages.length; i < len; i++) {
			var msg = messages[i];

			emitEvents(msg);
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

			if (syserror.reason === 'network') {
				// retry

				window.setTimeout(sendCurrent, options.timeOutRetry);
				return;
			}

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

		var message = JSON.stringify(data);

		// apply any hooks

		var header = [];

		// if there is a callback ID, we add that as the first hook

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

