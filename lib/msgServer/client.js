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

	this.cfg = {
		timeout: config.timeout || 15000
	};

	this.expectedMsgId = null;
	this.queryId = 0;
	this.commandSystemStarted = false;
	this.sessionKey = null;
	this.stream = null;

	this.setupCommandSystem();
}

inherits(MsgServer, EventEmitter);


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


MsgServer.prototype.simulateTransportError = function (type) {
	this.simulatedTransportError = type;
};


MsgServer.prototype.setupCommandSendFunction = function (hr) {
	var that = this;

	var cmdEndpoint = this.baseUrl;

	if (cmdEndpoint.substr(-1) !== '/') {
		cmdEndpoint += '/';
	}

	var timer = null;          // if this timer is active, we're about to send the currentQueue (which may still be expanded)
	var currentQueue = [];     // the queue we're building that will be sent _very_ soon
	var nextQueue = [];        // while we're locked, sendCommand() will push into nextQueue instead of currentQueue
	var nextQueueOpen = false; // to add commands to the nextQueue, this needs to be true (enabled through the msgServer.queue method)
	var locked = false;        // this is true for as long as a queryId has not been successfully completed
	var unlock;                // placeholder for unlock function, to avoid circular refs and upset jslint


	function handleTransportError(error) {
		that.emitEvent('io.error.' + error, { reason: error });
	}


	function onCommandResponse(transportError, responses) {
		// this is the response to the request that is now in the lastQueue array
		// [
		//   [sysError] or:
		//   [null, userError] or:
		//   [null, null, response obj, events array] // where events may be left out
		// ]

		if (transportError || that.simulatedTransportError) {
			// "auth": restart the auth process
			// "network": network failure (offline or timeout), retry is the only correct option
			// "busy": usually treat quietly

			handleTransportError(transportError || this.simulatedTransportError);
			delete this.simulatedTransportError;
			return;
		}

		// unlock the command system for the next user command(s)

		var queue = currentQueue;

		unlock();

		// from here on, handle all responses and drop the queue that we just received answers to

		that.emitEvent('io.response');

		// handle the command responses

		for (var i = 0; i < responses.length; i += 1) {
			var response = responses[i];
			var cmd = queue[i];

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
				that.emit("io." + cmd.name, cmdResponse, cmd.params);
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
		var hasCallbacks = false;
		var header = [], data, files;

		for (i = 0; i < len; i += 1) {
			var cmd = currentQueue[i];

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


	function addCommandToNextQueue(cmd) {
		nextQueue.push(cmd);
	}


	function addCommandToCurrentQueue(cmd) {
		currentQueue.push(cmd);

		if (timer === null) {
			that.queryId += 1;
			timer = window.setTimeout(sendCmdQueue, 0);

			that.emitEvent('io.queued', that.queryId);
		}
	}


	unlock = function () {
		currentQueue = [];

		// if there is a nextQueue, run it

		if (nextQueue) {
			for (var i = 0; i < nextQueue.length; i += 1) {
				addCommandToCurrentQueue(nextQueue[i]);
			}

			nextQueue = [];
		}

		locked = false;
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

		if (locked) {
			// if the nextQueue is open, add command to the queue

			if (nextQueueOpen) {
				addCommandToNextQueue(cmd);
			} else {
				console.warn('Could not queue user command. CurrentQueue and NextQueue are locked.', cmd);

				that.emitEvent('io.error.busy', { reason: 'busy', behavior: 'none' });
			}
		} else {
			addCommandToCurrentQueue(cmd);
		}
	};


	// the discard function can be called if after a transport error, when do not want to retry
	// it will unlock the command center for the next user command

	this.discard = function () {
		unlock();
		that.emitEvent('io.discarded');
	};


	this.resend = function () {
		if (!currentQueue || currentQueue.length === 0) {
			console.warn('No commands to retry. Discarded instead.');
			that.discard();
			return;
		}

		that.emitEvent('io.resend');

		sendCmdQueue();
	};


	this.queue = function (fn) {
		nextQueueOpen = true;
		fn();
		nextQueueOpen = false;
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
		this.stream = stream = this.createTransport('http-longpolling');

		if (stream) {
			stream.on('error', function (error) {
				if (error === 'auth') {
					// auth errors pause the event stream until reauthenticated

					stream.abort();
					that.emitEvent('io.error.auth', { reason: 'auth' });
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

	var cfg = this.cfg;

	var options = {};

	if (cfg.timeout) {
		if (cfg.timeout < 1000) {
			console.warn('Unreasonable timeout setting for IO system. Note that this is an interval in milliseconds.');
			return;
		} else {
			options.timeout = cfg.timeout;
		}
	}

	var hr = this.createTransport('http', options);
	if (!hr) {
		return;
	}

	// set up http client

	this.setupCommandSendFunction(hr);

	this.commandSystemStarted = true;
};

module.exports = MsgServer;