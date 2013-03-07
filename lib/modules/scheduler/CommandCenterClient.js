/** @module CommandCenterClient */

// We need the following to avoid an error due to a circular dependency.
/* jshint latedef: false */

var mage = require('../../mage');
var logger = mage.core.logger.context('scheduler');
var http = require('http');


/**
 * Resends a queue of commands, appending any old commands to the queue.
 *
 * @param {Object} cmdCtrClient an instance of CommandCenterClient
 * @param {Array}  queue
 * @private
 */

function resendQueue(cmdCtrClient, queue) {
	// Are the handles the same? If not, empty queue and append elements to this.queue
	if (cmdCtrClient.queue !== queue) {
		if (cmdCtrClient.queue.length) {
			// Prepend the old queue to the new one
			while (queue.length) {
				cmdCtrClient.queue.unshift(queue.pop());
			}
		} else {
			// New queue is empty, so just replace it.
			cmdCtrClient.queue = queue;
		}
	}

	// Wait for 1s before re-sending the queue
	// TODO: make it more flexible/configurable
	setTimerIfNeeded(cmdCtrClient, 1000);
}


/**
 * Logs failed queued commands and then attempts to resend.
 *
 * @param {Object} cmdCtrClient an instance of CommandCenterClient
 * @param {Array}  failedQueue
 * @private
 */

function onTransportError(cmdCtrClient, failedQueue) {
	cmdCtrClient.busy = false;
	logger.debug('CommandCenterClient: Will retry', failedQueue.length, 'command(s)...');
	resendQueue(cmdCtrClient, failedQueue);
}


/**
 * Attempts to send a queue of commands.
 *
 * @param {Object} cmdCtrClient an instance of CommandCenterClient
 * @private
 */

function sendQueue(cmdCtrClient) {
	if (cmdCtrClient.busy) {
		return setTimerIfNeeded(cmdCtrClient);
	}

	cmdCtrClient.busy = true;

	var failedItem;

	while ((failedItem = cmdCtrClient.failed.pop())) {
		cmdCtrClient.queue.unshift(failedItem);
	}

	var queue = cmdCtrClient.queue;

	var cmdNames = queue.map(function (x) {
		return x.name;
	});

	var cmdParams = queue.map(function (cmd) {
		return JSON.stringify(cmd.params);
	});

	var data = '[]\n' + cmdParams.join('\n');
	var path = '/' + cmdCtrClient.app + '/' + cmdNames.join(',');

	logger
		.debug
		.data({ commandNames: cmdNames, peer: cmdCtrClient.peer, data: data })
		.log('CommandCenterClient sending request');

	cmdCtrClient.timer = null;
	cmdCtrClient.queue = [];

	var reqOptions = {
		host: cmdCtrClient.host,
		port: cmdCtrClient.port,
		path: path,
		method: 'POST',
		headers: {
			"Content-Length": Buffer.byteLength(data)
		}
	};

	if (cmdCtrClient.auth) {
		reqOptions.headers.Authorization = 'Basic ' + cmdCtrClient.auth;
	}

	var req = http.request(reqOptions, function (res) {
		res.on('end', function () {
			cmdCtrClient.busy = false;
		});

		res.on('close', function () {
			logger.error('CommandCenterClient: Disconnected while receiving response from peer', cmdCtrClient.peer);
			onTransportError(cmdCtrClient, queue);
		});

		if (res.statusCode !== 200) {
			logger.error('CommandCenterClient: Got an unexpected status from peer', cmdCtrClient.peer, ':', res.statusCode);
			// Will not retry
		}
	});

	req.on('error', function (e) {
		logger.error('CommandCenterClient: Got a transport error from peer', cmdCtrClient.peer, ':', e.message);
		onTransportError(cmdCtrClient, queue);
	});

	req.write(data);
	req.end();
}


/**
 * Adds a delay to sending a queue.
 *
 * @param {Object} cmdCtrClient an instance of CommandCenterClient
 * @param {Number} [delay]      milliseconds
 * @private
 */

function setTimerIfNeeded(cmdCtrClient, delay) {
	if (cmdCtrClient.timer === null) {
		cmdCtrClient.timer = setTimeout(function () {
			cmdCtrClient.timer = null;
			sendQueue(cmdCtrClient);
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
 *  - No responses (since scheduler's user commands are void).
 *
 * @param {Object} config
 * @constructor
 * @alias module:CommandCenterClient
 */

function CommandCenterClient(config) {
	this.app = config.app;
	this.host = config.host;
	this.port = config.port || 80;

	if (config.auth) {
		this.auth = config.auth;
	}

	this.peer = 'http://' + this.host + ':' + this.port;
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

// Expose the constructor as the module.
module.exports = CommandCenterClient;
