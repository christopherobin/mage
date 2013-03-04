/** @module CommandCenterClient */
var mage = require('../../mage');
var logger = mage.core.logger;
var http = require('http');

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

	this.peer = [
		"http://",
		this.host,
		":",
		String(this.port)
	].join('');

	this.queue = [];
	this.failed = [];
	this.timer = null;
}

/**
 * Logs failed queued commands and then attempts to resent.
 *
 * @param {Array} failedQueue
 * @private
 */

CommandCenterClient.prototype._onTransportError = function (failedQueue) {
	this.busy = false;
	logger.debug('CommandCenterClient: Will retry ' + failedQueue.length + ' command(s)…');
	this._resendQueue(failedQueue);
};


/**
 * Attempts to send a queue of commands.
 *
 * @private
 */

CommandCenterClient.prototype._sendQueue = function () {
	if (this.busy) {
		return this._setTimerIfNeeded();
	}

	this.busy = true;

	var failedItem;

	while ((failedItem = this.failed.pop())) {
		this.queue.unshift(failedItem);
	}

	var queue = this.queue;

	var cmdNames = queue.map(function (x) {
		return x.name;
	});

	var cmdParams = queue.map(function (x) {
		return JSON.stringify(x.params);
	});

	var data = '[]\n' + cmdParams.join('\n');
	var path = '/' + this.app + '/' + cmdNames.join(',');

	logger
		.debug
		.data({ commandNames: cmdNames, peer: this.peer, data: data })
		.log('CommandCenterClient sending request');

	this.timer = null;
	this.queue = [];

	var that = this;
	var reqOptions = {
		host: this.host,
		port: this.port,
		path: path,
		method: 'POST',
		headers: {
			"Content-Length": Buffer.byteLength(data)
		}
	};

	if (this.auth) {
		reqOptions.headers.Authorization = 'Basic ' + this.auth;
	}

	var req = http.request(reqOptions, function (res) {
		res.on('end', function () {
			that.busy = false;
		});

		res.on('close', function () {
			logger.error('CommandCenterClient: Disconnected while receiving response from peer ' + that.peer + '.');
			that._onTransportError(queue);
		});

		if (res.statusCode !== 200) {
			logger.error('CommandCenterClient: Got an unexpected status from peer ' + that.peer + ': ' + res.statusCode);
			// Will not retry
		}
	});

	req.on('error', function (e) {
		logger.error('CommandCenterClient: Got a transport error from peer ' + that.peer + ': ' + e.message);
		that._onTransportError(queue);
	});

	req.write(data);
	req.end();
};


/**
 * Resends a queue of commands, appending any old commands to the queue.
 *
 * @param {Array} queue
 * @private
 */

CommandCenterClient.prototype._resendQueue = function (queue) {
	// Are the handles the same? If not, empty queue and append elements to this.queue
	if (this.queue !== queue) {
		if (this.queue.length) {
			// Prepend the old queue to the new one
			while (queue.length) {
				this.queue.unshift(queue.pop());
			}
		} else {
			// New queue is empty, so just replace it.
			this.queue = queue;
		}
	}

	// Wait for 1s before re-sending the queue
	// TODO: make it more flexible/configurable
	this._setTimerIfNeeded(1000);
};


/**
 * Adds a delay to sending a queue.
 *
 * @param {Number} delay milliseconds
 * @private
 */

CommandCenterClient.prototype._setTimerIfNeeded = function (delay) {
	if (this.timer === null) {
		var self = this;

		this.timer = setTimeout(function () {
			self.timer = null;
			self._sendQueue();
		}, delay || 0);
	}
};


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

	this._setTimerIfNeeded();
};

// Expose the constructor as the module.
module.exports = CommandCenterClient;
