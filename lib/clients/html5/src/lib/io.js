(function (window) {

	// message retrieval:

	var mithril = window.mithril;

	var io = mithril.io = new mithril.EventEmitter();

	io.transports = {};


	// default config, overridden through mithril.config.io

	var origin = 'http://$cfg(server.clientHost.expose.host):$cfg(server.clientHost.expose.port)';

	var defaults = {
		timeout: 10000
	};

	var cfg = {};

	// apply default config to cfg object

	for (var key in defaults) {
		cfg[key] = defaults[key];
	}


	function emitEvent(fullPath, params) {
		// accepts only a single params object (which may be of any type)

		var path = fullPath.split('.');

		while (path.length > 0) {
			io.emit.apply(io, [path.join('.'), fullPath, params]);

			path.pop();
		}
	}


	io.recursiveEmit = function (path, param1) {
		var len = arguments.length;

		if (len < 1) {
			return;
		}

		switch (len) {
		case 1:
			emitEvent(path);
			break;
		case 2:
			emitEvent(path, [param1]);
			break;
		default:
			var args = [param1];
			for (var i = 2; i < len; i++) {
				args.push(arguments[i]);
			}

			emitEvent(path, args);
			break;
		}
	};


	function emitEvents(events) {
		for (var i = 0, len = events.length; i < len; i++) {
			var evt = events[i];

			if (evt) {
				emitEvent(evt[0], evt[1]);
			}
		}
	}


	var expectedMsgId = null;
	var futurelog = {};	// queues up events that are early


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


	var lastCommand = null;	// url, data, [queryId], cb
	var cmdEndpoint;
	var queryId = 0;

	var sendCommand = function () {
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
				emitEvent('io.error.' + sysError.reason, [sysError]);
			} else {
				emitEvent('io.error', [sysError]);
			}
			return;
		}

		var cmd = lastCommand;
		lastCommand = null;

		var userError = msg[1];
		var response  = msg[2];
		var events    = msg[3];

		emitEvent('io.response');

		if (cmd && cmd.cb) {
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


	function createTransport(type, options) {
		// check transport availability

		if (!io.transports) {
			console.warn('IO could not start: No transports found.');
			return null;
		}

		var Transport = io.transports[type];
		if (!Transport) {
			console.warn('No transport', type, 'found.');
			return null;
		}

		return new Transport(options);
	}


	var sessionKey, stream;

	function setupEventSystem(altSessionKey) {
		var sessionChange = false;

		if (altSessionKey) {
			// sessionKey change or initialization

			if (altSessionKey !== sessionKey) {
				sessionChange = true;
				sessionKey = altSessionKey;
			}
		}

		// nothing to do if:
		// - there is no session key
		// - there is no session change, and the stream is already running

		if (!sessionKey || (!sessionChange && stream && stream.isRunning)) {
			return;
		}

		// a transport is required for the event stream

		if (!stream) {
			stream = createTransport('http-longpolling');

			if (stream) {
				stream.on('error', function (error) {
					if (error.reason === 'auth') {
						// authentications pause the event stream until reauthenticated

						stream.abort();
						io.recursiveEmit('io.error.auth', error);
					}
				});
			}
		}

		if (!stream) {
			// if not yet available, we postpone event system setup
			return;
		}

		var endpoint = origin + '/msgstream';
		var params = { sessionKey: sessionKey };

		stream.setup(endpoint, params, onMessages);
		stream.start();
	}


	var cmdHooks = {};
	var cmdHeaderDelimiter = '\t';


	io.registerCommandHook = function (name, fn) {
		cmdHooks[name] = fn;
	};


	io.send = function (commandName, data, options, cb) {
		// format: JSON header [{"name": "msession", ...},{"name": "mauth1.0", ... }]

		var command = mithril.appName + '/' + commandName;

		var message = JSON.stringify(data);

		// set up required hooks

		var hooks;

		if (Array.isArray(options.hooks)) {
			hooks = options.hooks;
		} else {
			hooks = [];
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

		var cmd = {
			url: cmdEndpoint + command.replace(/\./g, '/'),
			data: data,
			queryId: ++queryId,
			cb: cb
		};

		emitEvent('io.send', [{ command: commandName }]);

		sendCommand(cmd);
	};


	io.resend = function () {
		if (!lastCommand) {
			console.warn('Cannot re-send command, because none was registered.');
			return;
		}

		emitEvent('io.resend');

		sendCommand(lastCommand);
	};


	var commandSystemStarted = false;

	function setupCommandSystem() {
		if (commandSystemStarted) {
			return;
		}

		var options = {};

		if (cfg.timeout) {
			if (cfg.timeout < 1000) {
				console.warn('Unreasonable timeout setting for IO system. Note that this is an interval in milliseconds.');
				return;
			} else {
				options.timeout = cfg.timeout;
			}
		}

		var hr = createTransport('http', options);
		if (!hr) {
			return;
		}

		// set up http client on io.start

		cmdEndpoint = origin;

		if (cmdEndpoint.substr(-1) !== '/') {
			cmdEndpoint += '/';
		}

		sendCommand = function (cmd) {
			console.log('Sending command', cmd);

			var params = {};

			if (cmd.queryId) {
				params.queryId = cmd.queryId;
			}

			if (hr.send('POST', cmd.url, params, cmd.data, null, onCommandResponse)) {
				lastCommand = cmd;
			}
		};

		commandSystemStarted = true;
	}


	// on mithril setup, apply config and start the command system

	mithril.on('configure', function (config) {
		// override default config, this may fire as often as desired

		var opts = config ? config.io : null;

		if (opts) {
			for (var key in opts) {
				cfg[key] = opts[key];
			}
		}

		// set up command system

		setupCommandSystem();
	});


	// when a session key is available, start the event system
	// if the key changes, make the event system aware (by simply calling setupEventSystem again)
	// before the change, the event stream was probably paused due to an "auth" error.

	mithril.once('created.session', function (session) {
		session.on('sessionKey.set', function (key) {
			setupEventSystem(key);
		});
	});

	// when a mithril setup branch completes, the required transport may have become available

	mithril.on('setupComplete', function () {
		setupEventSystem();
	});

}(window));

