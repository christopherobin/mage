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

	var cmdHooks = {};
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


	io.recursiveEmit = function (path, params) {
		emitEvent(path, params);
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


	var queryId = 0;

	var sendCommand = function () {
		console.warn('Command system not yet set up.');
	};


	io.resend = function () {
		console.warn('Command system not yet set up.');
	};


	function setupCommandSendFunction(hr) {
		var cmdEndpoint = origin;

		if (cmdEndpoint.substr(-1) !== '/') {
			cmdEndpoint += '/';
		}

		var timer = null;
		var lastQueue = null;
		var nextQueue = [];


		function onCommandResponse(transportError, responses) {
			// this is the response to the request that is now in the lastQueue array
			// [
			//   [sysError] or:
			//   [null, userError] or:
			//   [null, null, response obj, events array] // where events may be left out
			// ]

			if (transportError) {
				// "server" or "network"

				emitEvent('io.error.' + transportError, { reason: transportError });
				return;
			}

			emitEvent('io.response');

			var queue = lastQueue;
			if (!queue) {
				return;
			}

			// reception of the last commands was really, absolutely positively successful, so we do not allow retry

			lastQueue = null;

			// handle the command responses

			for (var i = 0, len = responses.length; i < len; i++) {
				var response = responses[i];
				var cmd = queue[i];

				if (!cmd) {
					console.warn('No command found for response', response);
					continue;
				}

				var sysError    = response[0];
				var userError   = response[1];
				var cmdResponse = response[2];
				var events      = response[3];

				if (sysError) {
					emitEvent('io.error.' + sysError, { reason: sysError });	// TODO: drop the "reason"
					continue;
				}

				if (cmd.cb) {
					if (events) {
						emitEvents(events);
					}

					if (userError) {
						cmd.cb(userError);
					} else {
						cmd.cb(null, cmdResponse);
					}
				} else if (events) {
					emitEvents(events);
				}
			}
		}


		function sendCmdQueue() {
			timer = null;

			var queue = nextQueue;
			nextQueue = [];

			var i, len;

			// prepare data extraction

			len = queue.length;

			var cmdNames = new Array(len);
			var cmdParams = new Array(len);
			var hooks = [];
			var hasCallbacks = false;
			var header = [], data;

			for (i = 0; i < len; i++) {
				var cmd = queue[i];

				cmdNames[i] = cmd.name;
				cmdParams[i] = cmd.params;

				for (var j = 0, jlen = cmd.hooks.length; j < jlen; j++) {
					var hook = cmd.hooks[j];

					if (hooks.indexOf(hook) === -1) {
						hooks.push(hook);
					}
				}

				if (cmd.cb) {
					hasCallbacks = true;
				}
			}

			data = cmdParams.join('\n');

			// execute all hooks

			for (i = 0, len = hooks.length; i < len; i++) {
				var hookName = hooks[i];
				var fnHook = cmdHooks[hookName];

				if (!fnHook) {
					console.warn('Hook ' + hookName + ' required, but not registered.');
					continue;
				}

				var hookOutput = fnHook(data);
				if (hookOutput) {
					hookOutput.name = hookName;

					header.push(hookOutput);
				}
			}

			// emit io.send event with all command names as the argument

			emitEvent('io.send', cmdNames);

			// create a request

			var url = encodeURI(cmdEndpoint + mithril.appName + '/' + cmdNames.join(','));
			var urlParams = {};

			if (hasCallbacks) {
				urlParams.queryId = queryId;
			}

			// prepend the header before the cmd parameter data

			data = JSON.stringify(header) + '\n' + data;

			// send request to server

			if (hr.send('POST', url, urlParams, data, null, onCommandResponse)) {
				// hr.send() only returns false if "busy", which could really only happen when hammering buttons,
				// in which case we abort

				lastQueue = queue;	// for retries due to network failure
			}
		}


		sendCommand = function (cmdName, hooks, params, cb) {
			// cmdName is dot notation "moduleName.commandName"

			// stringify the params instantly,
			// so that they may be altered right after this call without affecting cmd execution

			var cmd = {
				name: cmdName,
				hooks: hooks,
				params: JSON.stringify(params),
				cb: cb
			};

			nextQueue.push(cmd);

			if (timer === null) {
				queryId++;
				timer = window.setTimeout(sendCmdQueue, 0);
			}

			emitEvent('io.queued', queryId);
		};


		io.resend = function () {
			if (!lastQueue) {
				console.warn('No commands to retry.');
				return;
			}

			nextQueue = lastQueue;
			lastQueue = null;

			emitEvent('io.resend');

			sendCmdQueue();
		};
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


	io.registerCommandHook = function (name, fn) {
		cmdHooks[name] = fn;
	};


	io.send = function (commandName, params, options, cb) {
		// set up required hooks

		var hooks;

		if (Array.isArray(options.hooks)) {
			hooks = options.hooks;
		} else {
			hooks = [];
		}
/*
		// currently not used
		if (Array.isArray(options.addHooks)) {
			hooks = hooks.concat(options.addHooks);
		}

		if (Array.isArray(options.ignoreHooks)) {
			hooks = hooks.filter(function (hook) {
				return options.ignoreHooks.indexOf(hook) === -1;
			});
		}
*/

		sendCommand(commandName, hooks, params, cb);
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

		setupCommandSendFunction(hr);

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

