// We need the following to avoid an error due to a circular dependency.
/* jshint latedef: false */

var http = require('http');
var url = require('url');

/**
 * Resends a queue of commands, appending any old commands to the queue.
 *
 * @param {Object} client An instance of CommandCenterClient
 * @param {Array}  queue
 * @private
 */

function resendQueue(client, queue) {
	// Are the handles the same? If not, empty queue and append elements to this.queue
	if (client.queue !== queue) {
		if (client.queue.length) {
			// Prepend the old queue to the new one
			while (queue.length) {
				client.queue.unshift(queue.pop());
			}
		} else {
			// New queue is empty, so just replace it.
			client.queue = queue;
		}
	}

	// Wait for 1s before re-sending the queue
	// TODO: make it more flexible/configurable
	setTimerIfNeeded(client, 1000);
}


/**
 * Logs failed queued commands and then attempts to resend.
 *
 * @param {Object} client      An instance of CommandCenterClient
 * @param {Array}  failedQueue
 * @private
 */

function onTransportError(client, failedQueue) {
	client.busy = false;
	client.logger.debug('Will retry', failedQueue.length, 'command(s)...');
	resendQueue(client, failedQueue);
}


/**
 * Attempts to send a queue of commands.
 *
 * @param {Object} client An instance of CommandCenterClient
 * @private
 */

function sendQueue(client) {
	if (client.busy) {
		return setTimerIfNeeded(client);
	}

	client.busy = true;

	var failedItem;

	while ((failedItem = client.failed.pop())) {
		client.queue.unshift(failedItem);
	}

	var queue = client.queue;

	var cmdNames = queue.map(function (x) {
		return x.name;
	});

	var cmdParams = queue.map(function (cmd) {
		return JSON.stringify(cmd.params);
	});

	var data = '[]\n' + cmdParams.join('\n');

	client.logger
		.debug
		.data({ commandNames: cmdNames, peer: client.peer, data: data })
		.log('Sending user command request batch');

	client.timer = null;
	client.queue = [];

	var endpoint = client.endpoint;

	var basePath = endpoint.path || '/';
	if (basePath[basePath.length - 1] !== '/') {
		basePath += '/';
	}

	if (basePath[0] !== '/') {
		basePath = '/' + basePath;
	}

	var reqOptions = {
		method: 'POST',
		auth: endpoint.auth,
		hostname: endpoint.hostname,
		port: endpoint.port,
		path: basePath + client.app + '/' + cmdNames.join(','),
		headers: {
			'Content-Length': Buffer.byteLength(data)
		}
	};

	var req = http.request(reqOptions, function (res) {
		res.on('end', function () {
			client.busy = false;
		});

		res.on('close', function () {
			client.logger.error('Disconnected while receiving response from peer', client.peer);
			onTransportError(client, queue);
		});

		if (res.statusCode !== 200) {
			client.logger.error('Got an unexpected status from peer', client.peer + ':', res.statusCode);
			// Will not retry
		}
	});

	req.on('error', function (e) {
		client.logger.error('Got a transport error from peer', client.peer + ':', e.message);
		onTransportError(client, queue);
	});

	req.write(data);
	req.end();
}


/**
 * Adds a delay to sending a queue.
 *
 * @param {Object} client  an instance of CommandCenterClient
 * @param {Number} [delay] milliseconds
 * @private
 */

function setTimerIfNeeded(client, delay) {
	if (client.timer === null) {
		client.timer = setTimeout(function () {
			client.timer = null;
			sendQueue(client);
		}, delay || 0);
	}
}


/**
 * Simple command center client used by the scheduler.
 *
 * Current limitations:
 *  - No hooks.
 *  - No files/blobs.
 *  - No callback.
 *  - No responses.
 *
 * @param {string} app      The name of the application we're talking to.
 * @param {Object} endpoint The "expose" configuration of the other end.
 * @param {Object} logger   A logger.
 * @constructor
 */

function CommandCenterClient(app, endpoint, logger) {
	this.logger = logger;
	this.app = app;

	if (typeof endpoint === 'string') {
		endpoint = url.parse(endpoint);
	}

	endpoint.protocol = endpoint.protocol || 'http';

	this.peer = url.format(endpoint);  // only used for logging
	this.endpoint = endpoint;

	this.queue = [];
	this.failed = [];
	this.timer = null;
}


/**
 * Sends a command.
 *
 * @param {String} commandName
 * @param {Object} params
 */

CommandCenterClient.prototype.send = function (commandName, params) {
	this.queue.push({
		name: commandName,
		params: params || {}
	});

	setTimerIfNeeded(this);
};


// Expose the constructor
exports.CommandCenterClient = CommandCenterClient;
