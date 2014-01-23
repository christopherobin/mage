var EventEmitter = require('emitter');
var inherits = require('inherit');


function MsgServer(appName, baseUrl, config) {
	EventEmitter.call(this);

	this.appName = appName;
	this.baseUrl = baseUrl;
	this.headers = {};

	var m = this.baseUrl.match(/^[a-z]+:(\/\/)([^:]+:[^:]+)@/i);
	if (m) {
		this.headers.Authorization = 'Basic ' + window.btoa(m[2]);
	}

	var HttpRequest = require('./transports/http/client.js').HttpRequest;
	var HttpLongPolling = require('./transports/http-longpolling/client.js').HttpLongPolling;
	var HttpShortPolling = require('./transports/http-shortpolling/client.js').HttpShortPolling;

	this.transports = {
		http: HttpRequest,
		"http-longpolling": HttpLongPolling,
		"http-shortpolling": HttpShortPolling
	};

	this.futurelog = {};	// queues up events that are early
	this.cmdHooks = [];

	config = config || {};

	if (config.timeout && config.timeout < 1000) {
		throw new Error('Unreasonable timeout setting for IO system. Note that this is an interval in milliseconds.');
	}

	this.cfg = {
		cmdMode: 'blocking',	// "free" or "blocking" if only one batch may be triggered at a time (locking the queue)
		pollOptions: {
			withCredentials: config.withCredentials,
			noCache: true
		},
		cmdOptions: {
			timeout: config.timeout || 15000,
			withCredentials: config.withCredentials,
			noCache: true
		}
	};

	this.queryId = 0;
	this.expectedMsgId = null;
	this.commandSystemStarted = false;
	this.sessionKey = null;
	this.stream = null;

	this.setupCommandSystem();
}

inherits(MsgServer, EventEmitter);


MsgServer.prototype.setCmdMode = function (mode) {
	if (mode !== 'free' && mode !== 'blocking') {
		throw new Error('Unrecognized command mode "' + mode + '", please use "free" or "blocking".');
	}

	this.cfg.cmdMode = mode;
};


MsgServer.prototype.emitEvent = function (fullPath, params) {
	// accepts only a single params object (which may be of any type)

	var path = fullPath.split('.');

	while (path.length) {
		this.emit.apply(this, [path.join('.'), fullPath, params]);
		path.pop();
	}
};


MsgServer.prototype.recursiveEmit = function (path, params) {
	this.emitEvent(path, params);
};


MsgServer.prototype.emitEvents = function (events) {
	for (var i = 0; i < events.length; i += 1) {
		var evt = events[i];

		if (evt) {
			this.emitEvent(evt[0], evt[1]); // magic array positions: path, params
		}
	}
};


MsgServer.prototype.sendCommand = function () {
	console.warn('msgServer#sendCommand: command system not yet set up.');
};


MsgServer.prototype.resend = function () {
	console.warn('msgServer.resend: command system not yet set up.');
};


MsgServer.prototype.discard = function () {
	console.warn('msgServer.discard: command system not yet set up.');
};


MsgServer.prototype.queue = function () {
	console.warn('msgServer.queue: command system not yet set up.');
};


MsgServer.prototype.piggyback = function () {
	console.warn('msgServer.piggyback: command system not yet set up.');
};


MsgServer.prototype.simulateTransportError = function (type) {
	this.simulatedTransportError = type;
};


MsgServer.prototype.setupCommandSendFunction = function (hr) {
	var that = this;

	var cmdEndpoint = this.baseUrl;

	if (cmdEndpoint.substr(-1) !== '/') {
		cmdEndpoint += '/';
	}

	var timer = null;      // if this timer is active, we're about to send the batches.current (which may still be expanded)
	var streaming = false; // if this is true, we will send batches.current the moment the running request returns
	var unlock;            // placeholder for unlock function, to avoid circular refs and upset jslint

	var batches = {
		current: [],       // the commands we're building that will be sent _very_ soon
		sending: []        // the commands that are currently being sent
	};

	var queueing = false;     // true when user commands are to be stored in the current batch, and should be sent off asap (through msgServer.queue method)
	var piggybacking = false; // true when user commands are to be stored in the current batch (through msgServer.piggyback method)
	var locked = false;       // this is true for as long as a queryId has not been successfully completed


	function handleTransportError(error, info) {
		that.emitEvent('io.error.' + error, { reason: error, info: info });
	}


	function onCommandResponse(transportError, responses) {
		// this is the response to the request that is now in the batches.sending array
		// [
		//   [sysError] or:
		//   [null, userError] or:
		//   [null, null, response obj, events array] // where events may be left out
		// ]

		if (transportError || that.simulatedTransportError) {
			// "auth": restart the auth process
			// "network": network failure (offline or timeout), retry is the only correct option
			// "busy": usually treat quietly

			handleTransportError(transportError || that.simulatedTransportError, responses);
			delete that.simulatedTransportError;
			return;
		}

		// unlock the command system for the next user command(s)

		var batch = batches.sending;

		unlock();

		// from here on, handle all responses and drop the queue that we just received answers to

		that.emitEvent('io.response');

		// handle the command responses

		for (var i = 0; i < responses.length; i += 1) {
			var response = responses[i];
			var cmd = batch[i];

			if (!cmd) {
				console.warn('No command found for response', response);
				continue;
			}

			var errorCode   = response[0];
			var cmdResponse = response[1];
			var events      = response[2];

			if (events) {
				that.emitEvents(events);
			}

			/*
			cmd = {
				name: cmdName,
				params: params,
				files: files,
				cb: cb
			};
			*/

			if (!errorCode) {
				that.emit('io.' + cmd.name, cmdResponse, cmd.params);
			}

			if (cmd.cb) {
				if (errorCode) {
					cmd.cb(errorCode);
				} else {
					cmd.cb(null, cmdResponse);
				}
			}
		}
	}


	var nextFileId = 0;


	function sendBatch(batch) {
		// here there is no need to check for locked, since that is taken care of by the caller of sendBatch

		locked = true;
		timer = null;

		nextFileId = 0;

		var i, len;

		// prepare data extraction

		len = batch.length;

		var cmdNames = new Array(len);
		var cmdParams = new Array(len);
		var hasCallbacks = false;
		var header = [], data, files;

		for (i = 0; i < len; i += 1) {
			var cmd = batch[i];

			cmdNames[i] = cmd.name;
			cmdParams[i] = cmd.params;

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

		for (i = 0, len = that.cmdHooks.length; i < len; i++) {
			var hook = that.cmdHooks[i];

			var hookOutput = hook.fn(data);
			if (hookOutput) {
				hookOutput.name = hook.name;

				header.push(hookOutput);
			}
		}

		// emit io.send event with all command names as the argument

		that.emitEvent('io.send', cmdNames);

		// create a request

		var url = encodeURI(cmdEndpoint + that.appName + '/' + cmdNames.join(','));
		var urlParams = {};

		if (hasCallbacks) {
			urlParams.queryId = that.queryId;
		}

		// prepend the header before the cmd parameter data

		data = JSON.stringify(header) + '\n' + data;

		// send request to server

		if (files) {
			var FormData = window.FormData;

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


		hr.send('POST', url, urlParams, data, that.headers, onCommandResponse);
	}


	function sendCurrentBatch() {
		batches.sending = batches.current;
		batches.current = [];

		// set streaming to false, a next user command can turn it on again

		streaming = false;

		sendBatch(batches.sending);
	}


	function scheduleCurrentBatch() {
		// - Set streaming to true, so nothing can pause us
		// - If no timer has been set yet, create a query ID, start a timer and prepare to
		//   send a new batch.

		streaming = true;

		if (locked) {
			// if the current stream is locked, the unlocking will trigger this function to be
			// called again.
			return;
		}

		if (timer === null) {
			that.queryId += 1;
			timer = window.setTimeout(sendCurrentBatch, 0);

			that.emitEvent('io.queued', that.queryId);
		}
	}


	function resendBatch() {
		sendBatch(batches.sending);
	}


	unlock = function () {
		// discard the last sent batch

		batches.sending = [];

		locked = false;

		// if there is a batch ready to be sent again, trigger the send

		if (batches.current.length > 0 && streaming) {
			scheduleCurrentBatch();
		}
	};


	// file upload helpers

	var uploads;

	function Upload(file) {
		this.file = file;
	}

	Upload.prototype.toJSON = function () {
		// returns the ID of the file

		var id = '__file' + nextFileId;

		nextFileId += 1;

		if (!uploads) {
			uploads = {};
		}

		uploads[id] = this.file;

		return id;
	};


	var Blob = window.Blob;
	var File = window.File;
	var FileList = window.FileList;


	/**
	 * Use this method to transform a File, Blob or FileList object to an object type that msgServer
	 * can upload. The result of this function may safely be put in of any parameter of a user
	 * command call.
	 *
	 * @param {File|Blob|FileList} file
	 * @param {boolean} silent          Set to true to suppress errors when the type doesn't match
	 * @returns {Upload|Upload[]}       An Upload instance, or an array of Upload instances
	 */

	this.transformUpload = function (file, silent) {
		if (file instanceof Blob || file instanceof File) {
			return new Upload(file);
		}

		if (file instanceof FileList) {
			var list = [];

			for (var i = 0; i < file.length; i++) {
				list.push(new Upload(file[i]));
			}

			return list;
		}

		if (!silent) {
			throw new TypeError('Given argument is not a Blob, File or FileList');
		}
	};


	/**
	 * This will deep-inspect any given object and transform File, Blob or FileList objects using
	 * the transformUpload method.
	 *
	 * @param {Object} obj
	 */

	this.transformEmbeddedUploads = function (obj) {
		var keys = Object.keys(obj || {});

		for (var i = 0; i < keys.length; i++) {
			var value = obj[keys[i]];

			if (value && typeof value === 'object') {
				var upload = this.transformUpload(value, true);

				if (upload) {
					obj[keys[i]] = upload;
				} else {
					this.transformEmbeddedUploads(obj[keys[i]]);
				}
			}
		}
	};


	this.sendCommand = function (cmdName, params, cb) {
		// cmdName is dot notation "moduleName.commandName"

		// serialize the params instantly, so that they may be altered right after this call without affecting cmd execution
		// the uploads list should be reset before, and after stringification

		uploads = null;

		params = JSON.stringify(params);

		// create the command object

		var cmd = {
			name: cmdName,
			params: params,
			files: uploads,
			cb: cb
		};

		uploads = null;


		if (piggybacking) {
			// Add the command to the current queue, but don't start sending anything just yet.
			// The next batch that gets scheduled will take these along.

			batches.current.push(cmd);
		} else if (locked) {
			// We're currently sending, but if the next batch is accessible, we can add the command
			// to it. That way it will be sent when the open request returns.

			if (queueing || that.cfg.cmdMode === 'free') {
				// add to current batch and make sure it will be sent off

				batches.current.push(cmd);

				scheduleCurrentBatch();
			} else {
				console.warn('Could not execute user command: busy.', cmd);

				that.emitEvent('io.error.busy', {
					reason: 'busy',
					command: cmd,
					blockedBy: batches.sending
				});
			}
		} else {
			// The command can be executed right now, so add to the current batch and make sure it
			// will be sent off

			batches.current.push(cmd);

			scheduleCurrentBatch();
		}
	};


	// the discard function can be called if after a transport error, when do not want to retry
	// it will unlock the command center for the next user command

	this.discard = function () {
		unlock();
		that.emitEvent('io.discarded');
	};


	this.resend = function () {
		if (!batches.sending.length) {
			console.warn('No commands to retry. Discarding instead.');
			that.discard();
			return;
		}

		that.emitEvent('io.resend');

		resendBatch();
	};


	this.queue = function (fn) {
		queueing = true;
		fn();
		queueing = false;
	};


	this.piggyback = function (fn) {
		piggybacking = true;
		fn();
		piggybacking = false;
	};
};


MsgServer.prototype.createTransport = function (type, options) {
	// check transport availability

	if (!this.transports) {
		console.warn('IO could not start: No transports found.');
		return null;
	}
	var Transport = this.transports[type];
	if (!Transport) {
		console.warn('No transport', type, 'found.');
		return null;
	}

	return new Transport(options);
};


MsgServer.prototype.setupEventSystem = function (altSessionKey) {
	var sessionChange = false;

	var sessionKey = this.sessionKey;
	var stream = this.stream;

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

	var that = this;

	// a transport is required for the event stream

	if (!stream) {
		this.stream = stream = this.createTransport('http-longpolling', this.cfg.pollOptions);

		if (stream) {
			stream.on('error', function (error, message) {
				if (error === 'auth') {
					// auth errors pause the event stream until reauthenticated

					stream.abort();
					that.emitEvent('io.error.auth', { reason: 'auth', message: message });
				}
			});
		}
	}

	if (!stream) {
		// if not yet available, we postpone event system setup
		return;
	}

	var endpoint = this.baseUrl + '/msgstream';
	var params = { sessionKey: sessionKey };
	var futurelog = this.futurelog;
	var expectedMsgId = this.expectedMsgId;

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
			expectedMsgId += 1;

			that.emitEvents(eventpack);
		}
	}

	stream.setup(endpoint, params, this.headers, onMessages);
	stream.start();
};


MsgServer.prototype.registerCommandHook = function (name, fn) {
	// replace the old command hook if there is one

	for (var i = 0; i < this.cmdHooks.length; i++) {
		var cmdHook = this.cmdHooks[i];

		if (cmdHook.name === name) {
			cmdHook.fn = fn;
			return;
		}
	}

	// else append to the end

	this.cmdHooks.push({ name: name, fn: fn });
};


MsgServer.prototype.send = function (commandName, params, options, cb) {
	this.sendCommand(commandName, params, cb);
};


MsgServer.prototype.setupCommandSystem = function () {
	if (this.commandSystemStarted) {
		return;
	}

	var hr = this.createTransport('http', this.cfg.cmdOptions);
	if (!hr) {
		return;
	}

	// set up http client

	this.setupCommandSendFunction(hr);

	this.commandSystemStarted = true;
};

module.exports = MsgServer;