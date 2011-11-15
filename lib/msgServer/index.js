var mithril = require('../mithril'),
    State   = require('../state').State,
    async   = require('async');

var comm = exports.comm = require('./comm');


// transport exposure:

var clientHost, httpServer;

exports.getClientHost = function () {
	return clientHost || null;
};

exports.getHttpServer = function () {
	return httpServer || null;
};


// message hooks

var messageHooks = {};


exports.registerMessageHook = function (type, fn) {
	messageHooks[type] = fn;
};


// mithril's own message hooks:

exports.registerMessageHook('mithril.callback', function (state, cfg, message, cb) {
	// if a callback ID has been given, we store it on the state object, so we can use it in our response

	if (cfg.id) {
		state.callbackId = cfg.id;
	}

	cb(null, message);
});


// startup messaging server

function getClientHostBindings() {
	var binding = mithril.getConfig('server.clientHost.bind');
	if (!binding) {
		mithril.core.logger.error('No clientHost binding configured');
		process.exit(-1);
	}

	return binding;
}


exports.setup = function () {
	// set up the clientHost

	var binding = getClientHostBindings();

	switch (binding.protocol) {
	case 'http':
		// also expose the clienthost as an http server

		clientHost = httpServer = require('./transports/http');
		break;
	default:
		mithril.fatalError('Unrecognized clientHost binding protocol:', binding.protocol);
		break;
	}
};


exports.start = function (server) {
	var binding = getClientHostBindings();

	if (!server) {
		server = clientHost.server;
	}

	// set up comm

	comm.setup();

	// listen

	try {
		if (binding.file) {
			server.listen(binding.file, function () {
				require('fs').chmod(binding.file, parseInt('777', 8));

				mithril.core.logger.info('Server running at ' + binding.protocol + '://' + binding.file);
			});
		} else if (binding.host && binding.port) {
			server.listen(binding.port, binding.host, function () {
				mithril.core.logger.info('Server running at ' + binding.protocol + '://' + binding.host + ':' + binding.port);
			});
		} else {
			mithril.fatalError('Required configuration missing: (server.clientHost.bind.host and server.clientHost.bind.port) or server.clientHost.bind.file');
		}
	} catch (e) {
		mithril.fatalError(e);
	}

	mithril.on('shutdown', function () {
		mithril.core.logger.info('Shutting down clientHost...');
		server.close();
	});
};


function processCommandHeader(state, header, message, cb) {
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
				// parse error, or other error, so we cannot respond

				cb(error);
			} else {
				// decode the message

				if (finalMessage.length === 0) {
					finalMessage = null;
				} else {
					try {
						finalMessage = JSON.parse(finalMessage);
					} catch (e) {
						state.error(null, 'Parse error in user command.', cb);
						return;
					}
				}

				// move on, in order to execute the command

				var tags = {};

				if (usedHooks.length > 0) {
					tags.hooks = usedHooks;
				}

				cb(null, tags, finalMessage);
			}
		}
	);
}


function processCommand(state, tags, path, queryId, params, cb) {
	if (path[0] === '/') {
		path = path.substring(1);
	}

	path = path.split('/');

	var packageName = path.shift();
	var cmdName = path.join('/');

	var commandCenter = mithril.core.commandCenters[packageName];
	if (commandCenter) {
		// execute the command

		commandCenter.execute(state, tags, cmdName, queryId, params, cb);
	} else {
		state.error(null, 'No command center found for package "' + packageName + '"', cb);
	}
}


exports.processCommandRequest = function (transportInfo, path, queryId, header, message, transportCallback) {
	// cb: function (content, options)

	var state = new State(null, null);

	state.onclose = transportCallback;

	processCommandHeader(state, header, message, function (error, tags, params) {
		if (error) {
			// direct error response, due to header parse error

			state.close();
		} else {
			// tag the request with the transport type

			tags.transport = transportInfo.type || null;

			// execute command

			processCommand(state, tags, path, queryId, params, function () {
				state.close();
			});
		}
	});
};

