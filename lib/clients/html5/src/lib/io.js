(function (window) {

	// message retrieval:

	var mithril = window.mithril;
	var Blob = window.Blob;
	var File = window.File;
	var FormData = window.FormData;

	var io = mithril.io = new mithril.EventEmitter();

	io.transports = {};

	var baseUrl = mithril.getClientHostBaseUrl(true);
	var origin = baseUrl.protocol + '://' + baseUrl.host + ':' + baseUrl.port;

	var defaults = {
		timeout: 15000
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
		console.warn('io#sendCommand: command system not yet set up.');
	};


	io.resend = function () {
		console.warn('io.resend: command system not yet set up.');
	};


	io.discard = function () {
		console.warn('io.discard: command system not yet set up.');
	};


	io.queue = function () {
		console.warn('io.queue: command system not yet set up.');
	};


	function setupCommandSendFunction(hr) {
		var cmdEndpoint = origin;

		if (cmdEndpoint.substr(-1) !== '/') {
			cmdEndpoint += '/';
		}

		var timer = null;          // if this timer is active, we're about to send the currentQueue (which may still be expanded)
		var currentQueue = [];     // the queue we're building that will be sent _very_ soon
		var nextQueue = [];        // while we're locked, sendCommand() will push into nextQueue instead of currentQueue
		var nextQueueOpen = false; // to add commands to the nextQueue, this needs to be true (enabled through the io.queue method)
		var locked = false;        // this is true for as long as a queryId has not been successfully completed
		var unlock;                // placeholder for unlock function, to avoid circular refs and upset jslint


		function handleTransportError(error) {
			emitEvent('io.error.' + error, { reason: error });
		}


		function onCommandResponse(transportError, responses) {
			// this is the response to the request that is now in the lastQueue array
			// [
			//   [sysError] or:
			//   [null, userError] or:
			//   [null, null, response obj, events array] // where events may be left out
			// ]

			if (transportError) {
				// "auth": restart the auth process
				// "network": network failure (offline or timeout), retry is the only correct option
				// "busy": usually treat quietly

				handleTransportError(transportError);
				return;
			}

			// unlock the command system for the next user command(s)

			var queue = currentQueue;

			unlock();

			// from here on, handle all responses and drop the queue that we just received answers to

			emitEvent('io.response');

			// handle the command responses

			for (var i = 0, len = responses.length; i < len; i++) {
				var response = responses[i];
				var cmd = queue[i];

				if (!cmd) {
					console.warn('No command found for response', response);
					continue;
				}

				var errorCode   = response[0];
				var cmdResponse = response[1];
				var events      = response[2];

				if (cmd.cb) {
					if (events) {
						emitEvents(events);
					}

					if (errorCode) {
						cmd.cb(errorCode);
					} else {
						cmd.cb(null, cmdResponse);
					}
				} else if (events) {
					emitEvents(events);
				}
			}
		}


		var nextFileId = 0;


		function sendCmdQueue() {
			// here there is no need to check for locked, since that is taken care of by the caller of sendCmdQueue

			locked = true;
			timer = null;

			nextFileId = 0;

			var i, len;

			// prepare data extraction

			len = currentQueue.length;

			var cmdNames = new Array(len);
			var cmdParams = new Array(len);
			var hooks = [];
			var hasCallbacks = false;
			var header = [], data, files;

			for (i = 0; i < len; i++) {
				var cmd = currentQueue[i];

				cmdNames[i] = cmd.name;
				cmdParams[i] = cmd.params;

				for (var j = 0, jlen = cmd.hooks.length; j < jlen; j++) {
					var hook = cmd.hooks[j];

					if (hooks.indexOf(hook) === -1) {
						hooks.push(hook);
					}
				}

				if (cmd.files) {
					if (!files) {
						files = {};
					}

					for (var fileId in cmd.files) {
						files[fileId] = cmd.files[fileId];
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

			if (files) {
				if (!FormData) {
					console.warn('window.FormData class not available, old browser?');
				} else {
					var form = new FormData();
					form.append('cmddata', data);

					for (var name in files) {
						form.append(name, files[name]);
					}

					data = form;
				}
			}

			hr.send('POST', url, urlParams, data, null, onCommandResponse);
		}


		function addCommandToNextQueue(cmd) {
			nextQueue.push(cmd);
		}


		function addCommandToCurrentQueue(cmd) {
			currentQueue.push(cmd);

			if (timer === null) {
				queryId++;
				timer = window.setTimeout(sendCmdQueue, 0);

				emitEvent('io.queued', queryId);
			}
		}


		unlock = function () {
			currentQueue = [];

			// if there is a nextQueue, run it

			if (nextQueue) {
				for (var i = 0, len = nextQueue.length; i < len; i++) {
					addCommandToCurrentQueue(nextQueue[i]);
				}

				nextQueue = [];
			}

			locked = false;
		};


		sendCommand = function (cmdName, hooks, params, cb) {
			// cmdName is dot notation "moduleName.commandName"

			// serialize the params instantly, so that they may be altered right after this call without affecting cmd execution

			var files, fileId, key, value, cmd;

			// handle file uploads

			if (Blob || File) {
				for (key in params) {
					value = params[key];

					if ((Blob && value instanceof Blob) || (File && value instanceof File)) {
						if (!files) {
							files = {};
						}

						fileId = '__file' + nextFileId;

						nextFileId += 1;

						// add the blob/file to the files list, and rewrite the parameter to its fileId so it can be serialized

						files[fileId] = value;
						params[key] = fileId;
					}
				}
			}

			// serialize the params and push the command request into the queue

			params = JSON.stringify(params);

			cmd = {
				name: cmdName,
				hooks: hooks,
				params: params,
				files: files,
				cb: cb
			};

			if (locked) {
				// if the nextQueue is open, add command to the queue

				if (nextQueueOpen) {
					addCommandToNextQueue(cmd);
				} else {
					console.warn('Could not queue user command. CurrentQueue and NextQueue are locked.', cmd);

					emitEvent('io.error.busy', { reason: 'busy', behavior: 'none' });
				}
			} else {
				addCommandToCurrentQueue(cmd);
			}
		};


		// the discard function can be called if after a transport error, when do not want to retry
		// it will unlock the command center for the next user command

		io.discard = function () {
			unlock();
			emitEvent('io.discarded');
		};


		io.resend = function () {
			if (!currentQueue || currentQueue.length === 0) {
				console.warn('No commands to retry. Discarded instead.');
				io.discard();
				return;
			}

			emitEvent('io.resend');

			sendCmdQueue();
		};


		io.queue = function (fn) {
			nextQueueOpen = true;
			fn();
			nextQueueOpen = false;
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
					if (error === 'auth') {
						// auth errors pause the event stream until reauthenticated

						stream.abort();
						emitEvent('io.error.auth', { reason: 'auth' });
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

