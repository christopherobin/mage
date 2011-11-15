(function () {

	// message retrieval:

	var mithril = window.mithril;

	var io = mithril.io = {
		transports: {}
	};


	// default config, overridden through mithril.config.io

	var origin = 'http://$cfg(server.clientHost.expose.host):$cfg(server.clientHost.expose.port)';

	var defaults = {
		defaultHooks: [],
		timeout: 10000
	};

	var cfg = {};

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

			if (!listeners[i]) {
				continue;
			}

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


	function onCommandResponse(sysError, msg) {
		// [sysError] or:
		// [null, userError] or:
		// [null, null, response obj, events array] // where events may be left out

		if (!sysError && msg[0]) {
			sysError = { reason: msg[0] };
		}

		if (sysError) {
			if (sysError.reason) {
				emit('io.error.' + sysError.reason, sysError);
			} else {
				emit('io.error', sysError);
			}
			return;
		}

		var cmd = current;
		current = null;

		var userError = msg[1];
		var response  = msg[2];
		var events    = msg[3];

		emit('io.response');

		if (response && cmd && cmd.cb) {
			if (events) {
				emitEvents(events);
			}

			if (userError) {
				cmd.cb(userError);
			} else {
				cmd.cb(null, response);
			}
		} else if (events) {
			emitEvents(events);
		}
	}


	function setupEventSystem() {
		var Transport = io.transports['http-longpolling'];

		var endpoint = origin + '/msgstream?sessionKey=' + window.encodeURIComponent(mithril.session.key);

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


	io.send = function (command, data, options, cb) {
		// options are optional

		if (typeof options === 'function') {
			cb = options;
			options = {};
		} else {
			options = options || {};
		}

		// format: JSON header [{"name": "msession", ...},{"name": "mauth1.0", ... }]

		command = mithril.packageName + '/' + command;

		var message = JSON.stringify(data);

		// set up required hooks

		var hooks = cfg.defaultHooks || defaults.defaultHooks;

		if (Array.isArray(options.hooks)) {
			hooks = options.hooks;
		}

		if (Array.isArray(options.addHooks)) {
			hooks = hooks.concat(options.addHooks);
		}

		if (Array.isArray(options.ignoreHooks)) {
			hooks = hooks.filter(function (hook) {
				return options.ignoreHooks.indexOf(hook) === -1;
			});
		}

		// apply hooks and create a header

		var header = [];

		for (var i = 0, len = hooks.length; i < len; i++) {
			var hookName = hooks[i];
			var hook = cmdHooks[hookName];

			if (!hook) {
				console.warn('Hook ' + hookName + ' required, but not registered.');
				continue;
			}

			var result = hook(message);

			if (result) {
				header.push(result.header);
				message = result.message;
			}
		}

		data = JSON.stringify(header) + cmdHeaderDelimiter + message;

		current = {
			url: cmdEndpoint + command.replace(/\./g, '/'),
			data: data,
			queryId: ++queryId,
			cb: cb
		};

		emit('io.send', { command: command });

		sendCurrent();
	};


	io.resend = function () {
		emit('io.resend');

		sendCurrent();
	};


	function setupCommandSystem() {
		var options = {};

		if (cfg.timeout) {
			if (cfg.timeout < 1000) {
				console.warn('Unreasonable timeout setting. Note that this is an interval in milliseconds.');
			} else {
				options.timeout = cfg.timeout;
			}
		}

		var HttpRequest = io.transports.http;
		var hr = new HttpRequest(options);


		// set up http client on io.start

		cmdEndpoint = origin;

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
		// apply default config to cfg object

		for (var key in defaults) {
			cfg[key] = defaults[key];
		}

		// override default config

		if (mithril.config && mithril.config.io) {
			var opts = mithril.config.io;

			for (key in opts) {
				cfg[key] = opts[key];
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

